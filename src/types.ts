/**
 * TypeScript type definitions for the Selenium + IntelliJ MCP Server.
 */

import type { LocatorStrategy, SupportedBrowser, TestFramework, BuildTool } from "./constants.js";

// --- Selenium Types ---

export interface SessionInfo {
  sessionId: string;
  browser: SupportedBrowser;
  capabilities: Record<string, unknown>;
  createdAt: string;
  gridNodeUrl?: string;
}

export interface ElementLocator {
  strategy: LocatorStrategy;
  value: string;
}

export interface ScreenshotResult {
  base64: string;
  format: "png";
  timestamp: string;
}

export interface ElementInfo {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  isDisplayed: boolean;
  isEnabled: boolean;
  isSelected: boolean;
  location: { x: number; y: number };
  size: { width: number; height: number };
}

export interface CookieInfo {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expiry?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}

// --- Grid Types ---

export interface GridNodeInfo {
  id: string;
  uri: string;
  status: string;
  maxSessions: number;
  activeSessions: number;
  stereotypes: Array<{
    browserName: string;
    browserVersion?: string;
    platformName?: string;
    maxInstances: number;
  }>;
}

export interface GridStatus {
  ready: boolean;
  message: string;
  nodes: GridNodeInfo[];
}

// --- Test Execution Types ---

export interface TestResult {
  name: string;
  className: string;
  status: "passed" | "failed" | "skipped" | "error";
  duration: number;
  message?: string;
  stackTrace?: string;
}

export interface TestSuiteResult {
  framework: TestFramework;
  buildTool: BuildTool;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  tests: TestResult[];
  output: string;
}

// --- Page Object Model Types ---

export interface PageElement {
  name: string;
  locatorStrategy: LocatorStrategy;
  locatorValue: string;
  description?: string;
  type: "button" | "input" | "link" | "text" | "select" | "checkbox" | "radio" | "custom";
}

export interface PageObjectConfig {
  className: string;
  packageName: string;
  baseUrl?: string;
  pageTitle?: string;
  elements: PageElement[];
  methods?: PageMethod[];
}

export interface PageMethod {
  name: string;
  returnType: string;
  description: string;
  steps: string[];
}

// --- IntelliJ Types ---

export interface IntelliJFileInfo {
  path: string;
  errors: number;
  warnings: number;
  diagnostics: Array<{
    severity: "ERROR" | "WARNING" | "INFO";
    message: string;
    line: number;
    column: number;
  }>;
}

export interface IntelliJRunConfig {
  name: string;
  type: string;
  isDefault: boolean;
}

export interface IntelliJProjectInfo {
  name: string;
  basePath: string;
  modules: string[];
  sdk: string;
  openFiles: string[];
}

// --- Recording Types (Selenium IDE-like) ---

export interface RecordedAction {
  command: string;
  target: string;
  value: string;
  timestamp: number;
}

export interface RecordedTest {
  name: string;
  baseUrl: string;
  actions: RecordedAction[];
  createdAt: string;
}

// --- Response Formatting ---

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}
