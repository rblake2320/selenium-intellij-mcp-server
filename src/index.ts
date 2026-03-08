#!/usr/bin/env node
/**
 * Selenium + IntelliJ MCP Server
 *
 * A comprehensive MCP server providing:
 * - Selenium WebDriver browser automation (all commands)
 * - Selenium Grid 4 management
 * - JUnit 4/5 and TestNG test execution
 * - Page Object Model scaffolding & generation
 * - IntelliJ IDEA integration (file ops, navigation, refactoring)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import * as selenium from "./services/selenium-service.js";
import * as grid from "./services/grid-service.js";
import * as intellij from "./services/intellij-service.js";
import * as testRunner from "./services/test-runner-service.js";
import * as pom from "./services/pom-service.js";
import * as recorder from "./services/recording-service.js";
import { SUPPORTED_BROWSERS, LOCATOR_STRATEGIES, TEST_FRAMEWORKS, BUILD_TOOLS, CHARACTER_LIMIT } from "./constants.js";

// ─── Shared Schemas ───────────────────────────────────────────────

const SessionIdSchema = z.string().describe("WebDriver session ID returned by selenium_create_session");

const LocatorSchema = z.object({
  strategy: z.enum(LOCATOR_STRATEGIES).describe("Element locator strategy"),
  value: z.string().describe("Locator value (e.g., '#submit', '//button[@id=\"go\"]')")
}).strict();

const ResponseFormatSchema = z.enum(["markdown", "json"]).default("markdown").describe("Output format");

// ─── Helpers ──────────────────────────────────────────────────────

function ok(data: unknown, format: string = "json"): { content: Array<{ type: "text"; text: string }> } {
  const text = format === "markdown" && typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const truncated = text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED — use filters or pagination]" : text;
  return { content: [{ type: "text", text: truncated }] };
}

function err(message: unknown): { content: Array<{ type: "text"; text: string }> } {
  const text = typeof message === "string" ? message : JSON.stringify(message);
  return { content: [{ type: "text", text: "[ERROR] " + text }] };
}

// ═══════════════════════════════════════════════════════════════════
//  MCP SERVER SETUP
// ═══════════════════════════════════════════════════════════════════

const server = new McpServer({
  name: "selenium-intellij-mcp-server",
  version: "1.0.0"
});

// ═══════════════════════════════════════════════════════════════════
//  SELENIUM WebDriver Tools (Tools 1-25)
// ═══════════════════════════════════════════════════════════════════

server.registerTool("selenium_create_session", {
  title: "Create WebDriver Session",
  description: "Create a new WebDriver session (local or Grid). Returns a sessionId for use with other tools.",
  inputSchema: {
    browser: z.enum(SUPPORTED_BROWSERS).default("chrome").describe("Browser type (chrome, firefox, safari, edge)"),
    remote_url: z.string().optional().describe("Selenium Grid URL (if omitted, uses local WebDriver)"),
    headless: z.boolean().default(false).describe("Run in headless mode (faster, no UI)"),
    incognito: z.boolean().default(false).describe("Run in private/incognito mode"),
    user_data_dir: z.string().optional().describe("Custom Chrome user data directory path"),
    accept_insecure_certs: z.boolean().default(false).describe("Accept insecure SSL certificates")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    const sessionId = await selenium.createSession(params.browser, {
      remoteUrl: params.remote_url,
      headless: params.headless,
      incognito: params.incognito,
      userDataDir: params.user_data_dir,
      acceptInsecureCerts: params.accept_insecure_certs
    });
    return ok({ sessionId, message: "Session created. Use this sessionId with other selenium tools." });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_navigate", {
  title: "Navigate to URL",
  description: "Navigate the browser to a URL.",
  inputSchema: {
    session_id: SessionIdSchema,
    url: z.string().url().describe("Target URL")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.navigateToUrl(params.session_id, params.url);
    return ok({ success: true, url: params.url });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_find_element", {
  title: "Find Element",
  description: "Find an element by locator strategy and value. Returns element attributes (tag, id, class, text, etc.).",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const element = await selenium.findElement(params.session_id, params.locator);
    return ok(element);
  } catch (e) { return err(e); }
});

server.registerTool("selenium_find_elements", {
  title: "Find Multiple Elements",
  description: "Find all elements matching a locator. Returns list of element attributes.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const elements = await selenium.findElements(params.session_id, params.locator);
    return ok({ count: elements.length, elements });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_click", {
  title: "Click Element",
  description: "Click an element by locator.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.clickElement(params.session_id, params.locator);
    return ok({ success: true, action: "clicked" });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_type", {
  title: "Type Text",
  description: "Type text into an input element.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema,
    text: z.string().describe("Text to type")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.typeText(params.session_id, params.locator, params.text);
    return ok({ success: true, action: "typed", text: params.text });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_clear", {
  title: "Clear Input",
  description: "Clear an input element.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.clearInput(params.session_id, params.locator);
    return ok({ success: true, action: "cleared" });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_get_text", {
  title: "Get Element Text",
  description: "Get the visible text content of an element.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const text = await selenium.getElementText(params.session_id, params.locator);
    return ok({ text });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_get_attribute", {
  title: "Get Element Attribute",
  description: "Get the value of an element attribute (e.g., 'value', 'placeholder', 'href', 'src').",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema,
    attribute: z.string().describe("Attribute name")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const value = await selenium.getAttributeValue(params.session_id, params.locator, params.attribute);
    return ok({ attribute: params.attribute, value });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_set_attribute", {
  title: "Set Element Attribute",
  description: "Set the value of an element attribute using JavaScript.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema,
    attribute: z.string().describe("Attribute name"),
    value: z.string().describe("New attribute value")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.setAttributeValue(params.session_id, params.locator, params.attribute, params.value);
    return ok({ success: true, attribute: params.attribute, value: params.value });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_is_displayed", {
  title: "Check Element Visibility",
  description: "Check if an element is visible on the page.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const displayed = await selenium.isElementDisplayed(params.session_id, params.locator);
    return ok({ displayed });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_is_enabled", {
  title: "Check Element State",
  description: "Check if an element is enabled (not disabled).",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const enabled = await selenium.isElementEnabled(params.session_id, params.locator);
    return ok({ enabled });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_is_selected", {
  title: "Check Checkbox/Radio Selected",
  description: "Check if a checkbox, radio button, or option is selected.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const selected = await selenium.isElementSelected(params.session_id, params.locator);
    return ok({ selected });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_submit_form", {
  title: "Submit Form",
  description: "Submit a form element.",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.submitForm(params.session_id, params.locator);
    return ok({ success: true, action: "form submitted" });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_screenshot", {
  title: "Take Screenshot",
  description: "Take a screenshot of the current page and save it to disk. Returns the file path.",
  inputSchema: {
    session_id: SessionIdSchema,
    filename: z.string().optional().describe("Output filename (auto-generated if omitted)")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    const path = await selenium.takeScreenshot(params.session_id, params.filename);
    return ok({ success: true, filepath: path });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_execute_script", {
  title: "Execute JavaScript",
  description: "Execute arbitrary JavaScript in the browser context. Useful for DOM manipulation, data extraction, and custom actions.",
  inputSchema: {
    session_id: SessionIdSchema,
    script: z.string().describe("JavaScript code to execute"),
    args: z.array(z.string()).optional().describe("Optional arguments passed to the script")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    const result = await selenium.executeScript(params.session_id, params.script, params.args);
    return ok(result);
  } catch (e) { return err(e); }
});

server.registerTool("selenium_get_current_url", {
  title: "Get Current URL",
  description: "Get the current URL of the browser.",
  inputSchema: {
    session_id: SessionIdSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const url = await selenium.getCurrentUrl(params.session_id);
    return ok({ url });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_get_page_source", {
  title: "Get Page Source",
  description: "Get the HTML source of the current page.",
  inputSchema: {
    session_id: SessionIdSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const source = await selenium.getPageSource(params.session_id);
    return ok(source, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("selenium_wait_for_element", {
  title: "Wait for Element",
  description: "Wait for an element to appear (up to timeout seconds).",
  inputSchema: {
    session_id: SessionIdSchema,
    locator: LocatorSchema,
    timeout: z.number().default(10).describe("Maximum wait time in seconds")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.waitForElement(params.session_id, params.locator, params.timeout);
    return ok({ success: true, message: "Element found" });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_switch_to_frame", {
  title: "Switch to Frame",
  description: "Switch to an iframe or frame element by locator or index.",
  inputSchema: {
    session_id: SessionIdSchema,
    frame_identifier: z.union([z.number(), z.object({strategy: z.enum(LOCATOR_STRATEGIES), value: z.string()})]).describe("Frame index (0-based) or locator object")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.switchToFrame(params.session_id, params.frame_identifier);
    return ok({ success: true, action: "switched to frame" });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_switch_to_parent_frame", {
  title: "Switch to Parent Frame",
  description: "Switch back to the parent frame or main content.",
  inputSchema: {
    session_id: SessionIdSchema
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async (params) => {
  try {
    await selenium.switchToParentFrame(params.session_id);
    return ok({ success: true, action: "switched to parent frame" });
  } catch (e) { return err(e); }
});

server.registerTool("selenium_delete_session", {
  title: "Delete Session",
  description: "Close the WebDriver session and release resources.",
  inputSchema: {
    session_id: SessionIdSchema
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await selenium.deleteSession(params.session_id);
    return ok({ success: true, message: "Session closed" });
  } catch (e) { return err(e); }
});

// ═══════════════════════════════════════════════════════════════════
//  SELENIUM GRID Tools (Tools 26-30)
// ═══════════════════════════════════════════════════════════════════

server.registerTool("grid_get_status", {
  title: "Get Grid Status",
  description: "Get the status of a Selenium Grid hub (version, nodes, sessions).",
  inputSchema: {
    grid_url: z.string().url().optional().describe("Selenium Grid URL (uses env SELENIUM_GRID_URL if omitted)")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const status = await grid.getGridStatus(params.grid_url);
    return ok(status);
  } catch (e) { return err(e); }
});

server.registerTool("grid_list_nodes", {
  title: "List Grid Nodes",
  description: "List all nodes registered with a Selenium Grid hub.",
  inputSchema: {
    grid_url: z.string().url().optional().describe("Selenium Grid URL (uses env SELENIUM_GRID_URL if omitted)")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const nodes = await grid.listNodes(params.grid_url);
    return ok({ nodes, count: nodes.length });
  } catch (e) { return err(e); }
});

server.registerTool("grid_list_sessions", {
  title: "List Active Sessions",
  description: "List all active WebDriver sessions on a Selenium Grid hub.",
  inputSchema: {
    grid_url: z.string().url().optional().describe("Selenium Grid URL (uses env SELENIUM_GRID_URL if omitted)")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const sessions = await grid.listSessions(params.grid_url);
    return ok({ sessions, count: sessions.length });
  } catch (e) { return err(e); }
});

server.registerTool("grid_kill_session", {
  title: "Kill Grid Session",
  description: "Kill a specific WebDriver session on a Selenium Grid hub.",
  inputSchema: {
    session_id: z.string().describe("WebDriver session ID"),
    grid_url: z.string().url().optional().describe("Selenium Grid URL (uses env SELENIUM_GRID_URL if omitted)")
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await grid.killSession(params.session_id, params.grid_url);
    return ok({ success: true, sessionId: params.session_id });
  } catch (e) { return err(e); }
});

server.registerTool("grid_debug_node", {
  title: "Debug Grid Node",
  description: "Get diagnostic information about a specific Grid node.",
  inputSchema: {
    node_id: z.string().describe("Node ID"),
    grid_url: z.string().url().optional().describe("Selenium Grid URL (uses env SELENIUM_GRID_URL if omitted)")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const info = await grid.getNodeDebugInfo(params.node_id, params.grid_url);
    return ok(info);
  } catch (e) { return err(e); }
});

// ═══════════════════════════════════════════════════════════════════
//  TEST RUNNER Tools (Tools 31-39)
// ═══════════════════════════════════════════════════════════════════

server.registerTool("test_run_junit", {
  title: "Run JUnit Tests",
  description: "Run JUnit (4 or 5) test classes in a project. Returns test results summary.",
  inputSchema: {
    project_root: z.string().describe("Path to Maven/Gradle project root"),
    test_class: z.string().optional().describe("Specific test class to run (e.g., 'MyTest' or 'com.example.MyTest')"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool (maven or gradle)"),
    test_method: z.string().optional().describe("Specific test method to run (e.g., 'testLogin')"),
    format: ResponseFormatSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const results = await testRunner.runJUnitTests(params.project_root, {
      testClass: params.test_class,
      testMethod: params.test_method,
      buildTool: params.build_tool
    });
    return ok(results, params.format);
  } catch (e) { return err(e); }
});

server.registerTool("test_run_testng", {
  title: "Run TestNG Tests",
  description: "Run TestNG test suite or class. Returns test results summary.",
  inputSchema: {
    project_root: z.string().describe("Path to Maven/Gradle project root"),
    test_class: z.string().optional().describe("Specific test class to run"),
    suite_file: z.string().optional().describe("testng.xml suite file path"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool"),
    format: ResponseFormatSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const results = await testRunner.runTestNGSuite(params.project_root, {
      testClass: params.test_class,
      suiteFile: params.suite_file,
      buildTool: params.build_tool
    });
    return ok(results, params.format);
  } catch (e) { return err(e); }
});

server.registerTool("test_run_all", {
  title: "Run All Tests",
  description: "Run all tests in a project (Maven 'test' or Gradle 'test' goal).",
  inputSchema: {
    project_root: z.string().describe("Path to project root"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool"),
    format: ResponseFormatSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const results = await testRunner.runAllTests(params.project_root, params.build_tool);
    return ok(results, params.format);
  } catch (e) { return err(e); }
});

server.registerTool("test_get_coverage", {
  title: "Get Test Coverage Report",
  description: "Generate a code coverage report (JaCoCo for Maven, Jacoco/Cobertura for Gradle).",
  inputSchema: {
    project_root: z.string().describe("Path to project root"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool"),
    format: ResponseFormatSchema
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const report = await testRunner.generateCoverageReport(params.project_root, params.build_tool);
    return ok(report, params.format);
  } catch (e) { return err(e); }
});

server.registerTool("test_list_test_methods", {
  title: "List Test Methods",
  description: "Parse a test class and list all test methods (by scanning for @Test, @BeforeEach, @AfterEach, etc.).",
  inputSchema: {
    test_file: z.string().describe("Path to test class file")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const methods = await testRunner.listTestMethods(params.test_file);
    return ok(methods);
  } catch (e) { return err(e); }
});

server.registerTool("test_extract_logs", {
  title: "Extract Test Logs",
  description: "Extract and parse test logs from surefire/failsafe reports.",
  inputSchema: {
    project_root: z.string().describe("Path to project root"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const logs = await testRunner.extractTestLogs(params.project_root, params.build_tool);
    return ok(logs, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("test_analyze_failures", {
  title: "Analyze Test Failures",
  description: "Analyze test failure reports and extract root cause information.",
  inputSchema: {
    project_root: z.string().describe("Path to project root"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const analysis = await testRunner.analyzeFailures(params.project_root, params.build_tool);
    return ok(analysis, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("test_parallel_execution", {
  title: "Run Tests in Parallel",
  description: "Run test suite with parallel execution configuration.",
  inputSchema: {
    project_root: z.string().describe("Path to project root"),
    thread_count: z.number().default(4).describe("Number of parallel threads"),
    build_tool: z.enum(BUILD_TOOLS).default("maven").describe("Build tool")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const results = await testRunner.runParallel(params.project_root, params.thread_count, params.build_tool);
    return ok(results);
  } catch (e) { return err(e); }
});

// ═══════════════════════════════════════════════════════════════════
//  PAGE OBJECT MODEL Tools (Tools 40-52)
// ═══════════════════════════════════════════════════════════════════

server.registerTool("pom_scaffold", {
  title: "Scaffold POM Class",
  description: "Generate a Page Object Model (POM) skeleton for a web page.",
  inputSchema: {
    page_name: z.string().describe("POM class name (e.g., 'LoginPage', 'DashboardPage')"),
    package_name: z.string().describe("Java package (e.g., 'com.example.pages')"),
    base_url: z.string().optional().describe("Page URL for documentation")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.scaffoldPomClass(params.page_name, params.package_name, params.base_url);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_generate_from_page", {
  title: "Generate POM from Web Page",
  description: "Analyze a web page and auto-generate a POM class with element locators.",
  inputSchema: {
    page_name: z.string().describe("POM class name"),
    package_name: z.string().describe("Java package"),
    page_html: z.string().describe("HTML source code of the page (can be from selenium_get_page_source)"),
    include_private_methods: z.boolean().default(false).describe("Generate private helper methods")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const code = pom.generateFromHtml(params.page_name, params.package_name, params.page_html, params.include_private_methods);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_add_element", {
  title: "Add Element to POM",
  description: "Generate code to add a new element locator and getter method to an existing POM.",
  inputSchema: {
    element_name: z.string().describe("Element variable name (e.g., 'submitButton', 'emailField')"),
    locator: LocatorSchema,
    element_type: z.enum(["button", "input", "link", "text", "checkbox", "dropdown", "list"]).describe("Element type for method naming")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generateElementCode(params.element_name, params.locator, params.element_type);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_add_action_method", {
  title: "Add Action Method to POM",
  description: "Generate a test action method (e.g., login, fillForm) based on a sequence of interactions.",
  inputSchema: {
    method_name: z.string().describe("Method name (e.g., 'login', 'submitForm')"),
    element_names: z.array(z.string()).describe("List of element names in interaction order"),
    method_body_description: z.string().describe("High-level description of what the method does")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generateActionMethod(params.method_name, params.element_names, params.method_body_description);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_generate_assertions", {
  title: "Generate POM Assertion Methods",
  description: "Generate assertion methods for a POM (e.g., verifyPageTitle, isLoginButtonDisplayed).",
  inputSchema: {
    assertions: z.array(z.object({
      name: z.string().describe("Assertion method name (e.g., 'verifyTitle')"),
      check_type: z.enum(["text", "visibility", "attribute", "enabled"]).describe("Type of assertion"),
      element_name: z.string().optional().describe("Element to check (if applicable)"),
      expected_value: z.string().optional().describe("Expected value")
    })).describe("List of assertions to generate")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generateAssertionMethods(params.assertions);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_generate_test_class", {
  title: "Generate Test Class from POM",
  description: "Generate a JUnit 5 or TestNG test class using a POM and action methods.",
  inputSchema: {
    test_name: z.string().describe("Test class name"),
    package_name: z.string().describe("Java package"),
    pom_reference: z.string().describe("POM class reference (e.g., 'com.example.pages.LoginPage')"),
    test_scenarios: z.array(z.object({
      name: z.string().describe("Test method name"),
      description: z.string().describe("Test scenario description")
    })).describe("List of test scenarios"),
    framework: z.enum(["junit5", "junit4", "testng"]).default("junit5").describe("Test framework")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generateTestClass(params.test_name, params.package_name, params.pom_reference, params.test_scenarios, params.framework);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_add_wait_conditions", {
  title: "Add Wait Conditions to POM",
  description: "Generate Explicit Wait (WebDriverWait) helper methods for a POM.",
  inputSchema: {
    element_names: z.array(z.string()).describe("Elements to create wait conditions for"),
    timeout_seconds: z.number().default(10).describe("Wait timeout in seconds")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generateWaitConditions(params.element_names, params.timeout_seconds);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_add_fluent_interface", {
  title: "Add Fluent Interface Methods",
  description: "Add fluent interface methods (returns 'this') to a POM for method chaining.",
  inputSchema: {
    action_methods: z.array(z.string()).describe("Action method names to make fluent")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generateFluentInterface(params.action_methods);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_analyze_page", {
  title: "Analyze Page Structure",
  description: "Analyze a web page's structure and suggest POM design patterns.",
  inputSchema: {
    page_html: z.string().describe("HTML source of the page"),
    complexity_level: z.enum(["simple", "moderate", "complex"]).default("moderate").describe("Suggested POM complexity")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}, async (params) => {
  try {
    const analysis = pom.analyzePageStructure(params.page_html, params.complexity_level);
    return ok(analysis, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("pom_generate_page_factory", {
  title: "Generate PageFactory Pattern Code",
  description: "Generate Selenium PageFactory (annotation-based) helper code.",
  inputSchema: {
    class_name: z.string().describe("POM class name"),
    package_name: z.string().describe("Java package"),
    elements: z.array(z.object({
      name: z.string().describe("Element variable name"),
      locator: LocatorSchema
    })).describe("Elements to annotate with @FindBy")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = pom.generatePageFactory(params.class_name, params.package_name, params.elements);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

// ═══════════════════════════════════════════════════════════════════
//  INTELLIJ Tools (Tools 53-64)
// ═══════════════════════════════════════════════════════════════════

server.registerTool("intellij_open_file", {
  title: "Open File in IntelliJ",
  description: "Open a file in IntelliJ IDEA editor.",
  inputSchema: {
    filepath: z.string().describe("Absolute file path"),
    line_number: z.number().optional().describe("Line number to jump to"),
    column: z.number().optional().describe("Column number")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.openFile(params.filepath, params.line_number, params.column);
    return ok({ success: true, file: params.filepath });
  } catch (e) { return err(e); }
});

server.registerTool("intellij_create_file", {
  title: "Create File in IntelliJ Project",
  description: "Create a new file in an IntelliJ project with optional template content.",
  inputSchema: {
    filepath: z.string().describe("Absolute file path"),
    content: z.string().optional().describe("File content"),
    template: z.string().optional().describe("Template type (java, test, xml, json, etc.)")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.createFile(params.filepath, params.content, params.template);
    return ok({ success: true, file: params.filepath });
  } catch (e) { return err(e); }
});

server.registerTool("intellij_run_configuration", {
  title: "Run IntelliJ Configuration",
  description: "Run a test or application configuration in IntelliJ (JUnit test, Maven goal, etc.).",
  inputSchema: {
    configuration_name: z.string().describe("Run configuration name"),
    wait_for_completion: z.boolean().default(true).describe("Wait for execution to complete")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const result = await intellij.runConfiguration(params.configuration_name, params.wait_for_completion);
    return ok(result);
  } catch (e) { return err(e); }
});

server.registerTool("intellij_refactor_rename", {
  title: "Rename (Refactor)",
  description: "Rename a class, method, or variable across the project (IntelliJ safe rename).",
  inputSchema: {
    old_name: z.string().describe("Current name"),
    new_name: z.string().describe("New name"),
    scope: z.enum(["file", "package", "project"]).default("project").describe("Refactoring scope")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.refactorRename(params.old_name, params.new_name, params.scope);
    return ok({ success: true, oldName: params.old_name, newName: params.new_name });
  } catch (e) { return err(e); }
});

server.registerTool("intellij_extract_method", {
  title: "Extract Method (Refactor)",
  description: "Extract a code block into a new method.",
  inputSchema: {
    filepath: z.string().describe("File path"),
    start_line: z.number().describe("Start line"),
    end_line: z.number().describe("End line"),
    method_name: z.string().describe("New method name"),
    visibility: z.enum(["public", "private", "protected", "package"]).default("private").describe("Method visibility")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.extractMethod(params.filepath, params.start_line, params.end_line, params.method_name, params.visibility);
    return ok({ success: true, method: params.method_name });
  } catch (e) { return err(e); }
});

server.registerTool("intellij_find_usages", {
  title: "Find Usages",
  description: "Find all usages of a class, method, or variable in the project.",
  inputSchema: {
    symbol_name: z.string().describe("Class, method, or variable name to find")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const usages = await intellij.findUsages(params.symbol_name);
    return ok(usages);
  } catch (e) { return err(e); }
});

server.registerTool("intellij_go_to_declaration", {
  title: "Go to Declaration",
  description: "Navigate to the declaration of a class, method, or variable.",
  inputSchema: {
    symbol_name: z.string().describe("Class, method, or variable name")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const location = await intellij.goToDeclaration(params.symbol_name);
    return ok(location);
  } catch (e) { return err(e); }
});

server.registerTool("intellij_generate_getter_setter", {
  title: "Generate Getters/Setters",
  description: "Generate getter and setter methods for a Java class.",
  inputSchema: {
    filepath: z.string().describe("Path to Java class file"),
    fields: z.array(z.string()).optional().describe("Specific fields to generate for (all if omitted)")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = await intellij.generateGettersSetters(params.filepath, params.fields);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("intellij_add_import", {
  title: "Add Import Statement",
  description: "Add an import statement to a Java file.",
  inputSchema: {
    filepath: z.string().describe("Java file path"),
    import_statement: z.string().describe("Import statement (e.g., 'java.util.List', 'org.junit.jupiter.api.Test')")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.addImport(params.filepath, params.import_statement);
    return ok({ success: true, import: params.import_statement });
  } catch (e) { return err(e); }
});

server.registerTool("intellij_organize_imports", {
  title: "Organize Imports",
  description: "Organize (sort and remove unused) imports in a Java file.",
  inputSchema: {
    filepath: z.string().describe("Java file path")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.organizeImports(params.filepath);
    return ok({ success: true, file: params.filepath });
  } catch (e) { return err(e); }
});

server.registerTool("intellij_format_code", {
  title: "Format Code",
  description: "Format code in a file (apply IntelliJ code style).",
  inputSchema: {
    filepath: z.string().describe("File path"),
    start_line: z.number().optional().describe("Start line (entire file if omitted)"),
    end_line: z.number().optional().describe("End line")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    await intellij.formatCode(params.filepath, params.start_line, params.end_line);
    return ok({ success: true, file: params.filepath });
  } catch (e) { return err(e); }
});

// ═══════════════════════════════════════════════════════════════════
//  RECORDING & PLAYBACK Tools (Tools 65-72)
// ═══════════════════════════════════════════════════════════════════

server.registerTool("recording_start", {
  title: "Start Recording",
  description: "Start recording user interactions (clicks, typing, navigation) for playback or export.",
  inputSchema: {
    name: z.string().describe("Recording session name (e.g., 'login_flow')"),
    base_url: z.string().url().optional().describe("Base URL for context (e.g., https://example.com)"),
    include_screenshots: z.boolean().default(false).describe("Include screenshots in recording")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const rec = recorder.startRecording(params.name, { baseUrl: params.base_url, includeScreenshots: params.include_screenshots });
    return ok(rec);
  } catch (e) { return err(e); }
});

server.registerTool("recording_add_action", {
  title: "Add Action to Recording",
  description: "Manually add an action (click, type, assertion) to a recording session.",
  inputSchema: {
    name: z.string().describe("Recording name"),
    command: z.string().describe("Selenium IDE command (e.g., 'click', 'type', 'assertText')"),
    target: z.string().describe("Target locator (e.g., 'id=username', 'css=#submit', 'xpath=//button')"),
    value: z.string().default("").describe("Value for the command (e.g., text to type, expected assertion text)")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (params) => {
  try {
    const action = recorder.addAction(params.name, {
      command: params.command, target: params.target, value: params.value
    });
    if (!action) return err(`Recording '${params.name}' not found. Start it first with recording_start.`);
    return ok(action);
  } catch (e) { return err(e); }
});

server.registerTool("recording_stop", {
  title: "Stop Recording",
  description: "Stop and retrieve the current recording with all actions.",
  inputSchema: { name: z.string().describe("Recording name") },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const rec = recorder.stopRecording(params.name);
    if (!rec) return err(`Recording '${params.name}' not found.`);
    return ok(rec);
  } catch (e) { return err(e); }
});

server.registerTool("recording_list", {
  title: "List Recordings",
  description: "List all saved recordings with action counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async () => {
  try {
    const recs = recorder.listRecordings().map(r => ({
      name: r.name, baseUrl: r.baseUrl, actions: r.actions.length, createdAt: r.createdAt
    }));
    return ok(recs);
  } catch (e) { return err(e); }
});

server.registerTool("recording_export_java", {
  title: "Export Recording to Java",
  description: "Export a recording as a runnable Java test class (JUnit 4, JUnit 5, or TestNG).",
  inputSchema: {
    name: z.string().describe("Recording name"),
    package_name: z.string().describe("Java package (e.g., 'com.example.tests')"),
    framework: z.enum(TEST_FRAMEWORKS).default("junit5"),
    class_name: z.string().optional().describe("Custom class name (auto-generated if omitted)")
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const code = recorder.exportToJava(params.name, {
      packageName: params.package_name,
      framework: params.framework,
      className: params.class_name
    });
    if (!code) return err(`Recording '${params.name}' not found.`);
    return ok(code, "markdown");
  } catch (e) { return err(e); }
});

server.registerTool("recording_export_side", {
  title: "Export as Selenium IDE File",
  description: "Export a recording as a Selenium IDE .side JSON file compatible with Selenium IDE browser extension.",
  inputSchema: { name: z.string().describe("Recording name") },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const side = recorder.exportToSide(params.name);
    if (!side) return err(`Recording '${params.name}' not found.`);
    return ok(side);
  } catch (e) { return err(e); }
});

server.registerTool("recording_delete", {
  title: "Delete Recording",
  description: "Delete a saved recording.",
  inputSchema: { name: z.string().describe("Recording name") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
}, async (params) => {
  try {
    const deleted = recorder.deleteRecording(params.name);
    return ok({ deleted, name: params.name });
  } catch (e) { return err(e); }
});

// ═══════════════════════════════════════════════════════════════════
//  SERVER STARTUP
// ═══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  // Configure from environment
  if (process.env.SELENIUM_GRID_URL) grid.setGridUrl(process.env.SELENIUM_GRID_URL);
  if (process.env.INTELLIJ_REST_PORT || process.env.INTELLIJ_MCP_PORT) {
    intellij.setIdePorts(
      process.env.INTELLIJ_REST_PORT ? parseInt(process.env.INTELLIJ_REST_PORT) : undefined,
      process.env.INTELLIJ_MCP_PORT ? parseInt(process.env.INTELLIJ_MCP_PORT) : undefined
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 selenium-intellij-mcp-server running via stdio");
  console.error(`   Tools registered: 64`);
  console.error("   Categories: Selenium WebDriver, Grid, JUnit/TestNG, POM, IntelliJ, Recording");
}

main().catch(error => {
  console.error("Fatal:", error);
  process.exit(1);
});