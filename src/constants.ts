/**
 * Shared constants for the Selenium + IntelliJ MCP Server.
 */

/** Maximum response size in characters before truncation */
export const CHARACTER_LIMIT = 25000;

/** Default Selenium WebDriver timeout (ms) */
export const DEFAULT_TIMEOUT = 30000;

/** Default implicit wait (ms) */
export const DEFAULT_IMPLICIT_WAIT = 10000;

/** Default page load timeout (ms) */
export const DEFAULT_PAGE_LOAD_TIMEOUT = 60000;

/** Default script timeout (ms) */
export const DEFAULT_SCRIPT_TIMEOUT = 30000;

/** IntelliJ REST API default port */
export const INTELLIJ_DEFAULT_PORT = 63342;

/** IntelliJ MCP SSE default port (IDE Index MCP plugin) */
export const INTELLIJ_MCP_PORT = 29170;

/** Selenium Grid default hub URL */
export const GRID_DEFAULT_URL = "http://localhost:4444";

/** Supported browsers */
export const SUPPORTED_BROWSERS = ["chrome", "firefox", "edge", "safari"] as const;
export type SupportedBrowser = typeof SUPPORTED_BROWSERS[number];

/** Supported locator strategies */
export const LOCATOR_STRATEGIES = [
  "id", "name", "className", "tagName", "css", "xpath", "linkText", "partialLinkText"
] as const;
export type LocatorStrategy = typeof LOCATOR_STRATEGIES[number];

/** Supported test frameworks */
export const TEST_FRAMEWORKS = ["junit4", "junit5", "testng"] as const;
export type TestFramework = typeof TEST_FRAMEWORKS[number];

/** Supported build tools */
export const BUILD_TOOLS = ["maven", "gradle"] as const;
export type BuildTool = typeof BUILD_TOOLS[number];
