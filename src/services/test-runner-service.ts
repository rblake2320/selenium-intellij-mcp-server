/**
 * Test runner service — executes JUnit 4/5 and TestNG tests via Maven or Gradle.
 * Parses XML test reports (Surefire/Failsafe format) for structured results.
 */

import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { TestResult, TestSuiteResult } from "../types.js";
import type { TestFramework, BuildTool } from "../constants.js";

const execFileAsync = promisify(execFile);

// ─── Test Execution ───────────────────────────────────────────────

export async function runTests(options: {
  projectPath: string;
  buildTool: BuildTool;
  framework: TestFramework;
  testClass?: string;
  testMethod?: string;
  tags?: string[];
  profiles?: string[];
  parallel?: boolean;
  timeout?: number;
}): Promise<TestSuiteResult> {
  const { projectPath, buildTool, framework, testClass, testMethod, tags, profiles, parallel, timeout = 300000 } = options;
  const resolvedPath = resolve(projectPath);

  let command: string;
  let args: string[];

  if (buildTool === "maven") {
    command = process.platform === "win32" ? "mvn.cmd" : "mvn";
    args = ["test", "-B", "--no-transfer-progress"];

    // Test filtering
    if (testClass) {
      args.push(`-Dtest=${testClass}${testMethod ? `#${testMethod}` : ""}`);
    }
    if (tags && tags.length > 0) {
      if (framework === "junit5") {
        args.push(`-Dgroups=${tags.join(",")}`);
      } else if (framework === "testng") {
        args.push(`-Dgroups=${tags.join(",")}`);
      }
    }
    if (profiles && profiles.length > 0) {
      args.push(`-P${profiles.join(",")}`);
    }
    if (parallel) {
      args.push("-DforkCount=2C", "-DreuseForks=true");
    }
    args.push("-Dsurefire.useFile=false");
  } else {
    // Gradle
    command = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
    args = ["test", "--no-daemon", "--console=plain"];

    if (testClass) {
      args.push("--tests", testMethod ? `${testClass}.${testMethod}` : testClass);
    }
    if (parallel) {
      args.push("--parallel");
    }
  }

  let output: string;
  let exitCode = 0;

  try {
    const result = await execFileAsync(command, args, {
      cwd: resolvedPath,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, JAVA_TOOL_OPTIONS: "" }
    });
    output = result.stdout + "\n" + result.stderr;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    output = (execError.stdout ?? "") + "\n" + (execError.stderr ?? "");
    exitCode = execError.code ?? 1;
  }

  // Parse test results from XML reports
  const tests = await parseTestReports(resolvedPath, buildTool);

  const passed = tests.filter(t => t.status === "passed").length;
  const failed = tests.filter(t => t.status === "failed").length;
  const skipped = tests.filter(t => t.status === "skipped").length;
  const errors = tests.filter(t => t.status === "error").length;

  return {
    framework,
    buildTool,
    totalTests: tests.length,
    passed, failed, skipped, errors,
    duration: tests.reduce((sum, t) => sum + t.duration, 0),
    tests,
    output: output.slice(-5000) // Last 5K of output
  };
}

// ─── Report Parsing ───────────────────────────────────────────────

async function parseTestReports(projectPath: string, buildTool: BuildTool): Promise<TestResult[]> {
  const reportDirs = buildTool === "maven"
    ? [join(projectPath, "target", "surefire-reports"), join(projectPath, "target", "failsafe-reports")]
    : [join(projectPath, "build", "test-results", "test")];

  const results: TestResult[] = [];

  for (const dir of reportDirs) {
    try {
      const files = await readdir(dir);
      const xmlFiles = files.filter(f => f.startsWith("TEST-") && f.endsWith(".xml"));

      for (const xmlFile of xmlFiles) {
        try {
          const content = await readFile(join(dir, xmlFile), "utf-8");
          results.push(...parseJUnitXml(content));
        } catch { /* skip unreadable files */ }
      }
    } catch { /* directory doesn't exist, skip */ }
  }

  return results;
}

function parseJUnitXml(xml: string): TestResult[] {
  const results: TestResult[] = [];

  // Simple XML parsing for Surefire/JUnit XML format
  const testCaseRegex = /<testcase\s+([^>]*)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  let match: RegExpExecArray | null;

  while ((match = testCaseRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2] ?? "";

    const name = extractAttr(attrs, "name") ?? "unknown";
    const className = extractAttr(attrs, "classname") ?? "unknown";
    const time = parseFloat(extractAttr(attrs, "time") ?? "0");

    let status: TestResult["status"] = "passed";
    let message: string | undefined;
    let stackTrace: string | undefined;

    if (body.includes("<failure")) {
      status = "failed";
      const failMatch = body.match(/<failure[^>]*message="([^"]*?)"[^>]*>([\s\S]*?)<\/failure>/);
      message = failMatch?.[1] ?? "Test failed";
      stackTrace = failMatch?.[2]?.trim();
    } else if (body.includes("<error")) {
      status = "error";
      const errMatch = body.match(/<error[^>]*message="([^"]*?)"[^>]*>([\s\S]*?)<\/error>/);
      message = errMatch?.[1] ?? "Test error";
      stackTrace = errMatch?.[2]?.trim();
    } else if (body.includes("<skipped")) {
      status = "skipped";
      const skipMatch = body.match(/<skipped[^>]*message="([^"]*)/);
      message = skipMatch?.[1];
    }

    results.push({ name, className, status, duration: time * 1000, message, stackTrace });
  }

  return results;
}

function extractAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}

// ─── Test Discovery ───────────────────────────────────────────────

export async function discoverTests(options: {
  projectPath: string;
  buildTool: BuildTool;
}): Promise<string[]> {
  const { projectPath, buildTool } = options;
  const resolvedPath = resolve(projectPath);
  const testDirs = buildTool === "maven"
    ? [join(resolvedPath, "src", "test", "java")]
    : [join(resolvedPath, "src", "test", "java")];

  const testFiles: string[] = [];

  for (const dir of testDirs) {
    try {
      await findTestFiles(dir, testFiles);
    } catch { /* directory doesn't exist */ }
  }

  return testFiles;
}

async function findTestFiles(dir: string, results: string[]): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await findTestFiles(fullPath, results);
      } else if (entry.name.endsWith("Test.java") || entry.name.endsWith("Tests.java") || entry.name.endsWith("IT.java")) {
        results.push(fullPath);
      }
    }
  } catch { /* skip unreadable directories */ }
}

// ─── Dependency Check ─────────────────────────────────────────────

export async function checkBuildTool(projectPath: string): Promise<BuildTool | null> {
  const resolvedPath = resolve(projectPath);
  try {
    const files = await readdir(resolvedPath);
    if (files.includes("pom.xml")) return "maven";
    if (files.includes("build.gradle") || files.includes("build.gradle.kts")) return "gradle";
    return null;
  } catch { return null; }
}