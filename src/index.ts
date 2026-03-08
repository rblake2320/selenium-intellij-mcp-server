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
import {
  SUPPORTED_BROWSERS,
  LOCATOR_STRATEGIES,
  TEST_FRAMEWORKS,
  BUILD_TOOLS,
  CHARACTER_LIMIT,
  INTELLIJ_DEFAULT_PORT,
  INTELLIJ_MCP_PORT,
  GRID_DEFAULT_URL,
} from "./constants.js";

// ─── Shared Schemas ───────────────────────────────────────────────

const SessionIdSchema = z
  .string()
  .describe("WebDriver session ID returned by selenium_create_session");

const LocatorSchema = z
  .object({
    strategy: z
      .enum(LOCATOR_STRATEGIES)
      .describe("Element locator strategy"),
    value: z
      .string()
      .describe("Locator value (e.g., '#submit', '//button[@id=\"go\"]')"),
  })
  .strict();

const ResponseFormatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format");

// ─── Helpers ──────────────────────────────────────────────────────

function ok(
  data: unknown,
  format: string = "json"
): { content: Array<{ type: "text"; text: string }> } {
  const text =
    format === "markdown"
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function err(error: string): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: `ERROR: ${error}`,
      },
    ],
  };
}

// ─── Initialize MCP Server ────────────────────────────────────────

const server = new McpServer({
  name: "selenium-intellij-mcp-server",
  version: "1.0.0",
});

// ─── SELENIUM TOOLS ─────────────────────────────────────────────────

server.tool(
  "selenium_create_session",
  "Create a WebDriver session and return session ID",
  {
    browser: z
      .enum(SUPPORTED_BROWSERS)
      .describe("Browser to launch"),
    headless: z
      .boolean()
      .default(false)
      .describe("Run headless"),
    url: z
      .string()
      .optional()
      .describe("URL to navigate to after session creation"),
  },
  async (params) => {
    try {
      const sessionId = selenium.createSession(
        params.browser,
        params.headless,
        params.url
      );
      return ok({ sessionId });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_navigate",
  "Navigate to a URL",
  {
    sessionId: SessionIdSchema,
    url: z.string().describe("URL to navigate to"),
  },
  async (params) => {
    try {
      selenium.navigate(params.sessionId, params.url);
      return ok({ success: true, url: params.url });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_find_element",
  "Find an element on the page",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const element = selenium.findElement(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ elementId: element.id });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_find_elements",
  "Find multiple elements on the page",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const elements = selenium.findElements(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({
        count: elements.length,
        elementIds: elements.map((e) => e.id),
      });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_click_element",
  "Click on an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.clickElement(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_send_keys",
  "Send text to an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
    text: z.string().describe("Text to send"),
  },
  async (params) => {
    try {
      selenium.sendKeys(
        params.sessionId,
        params.locator.strategy,
        params.locator.value,
        params.text
      );
      return ok({ success: true, text: params.text });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_clear_element",
  "Clear an input element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.clearElement(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_submit_form",
  "Submit a form element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.submitForm(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_text",
  "Get text from an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const text = selenium.getText(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ text });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_attribute",
  "Get an attribute from an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
    attribute: z.string().describe("Attribute name"),
  },
  async (params) => {
    try {
      const value = selenium.getAttribute(
        params.sessionId,
        params.locator.strategy,
        params.locator.value,
        params.attribute
      );
      return ok({ attribute: params.attribute, value });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_is_displayed",
  "Check if an element is displayed",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const displayed = selenium.isDisplayed(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ displayed });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_is_enabled",
  "Check if an element is enabled",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const enabled = selenium.isEnabled(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ enabled });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_is_selected",
  "Check if an element is selected",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const selected = selenium.isSelected(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ selected });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_current_url",
  "Get the current URL",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const url = selenium.getCurrentUrl(params.sessionId);
      return ok({ url });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_title",
  "Get the page title",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const title = selenium.getTitle(params.sessionId);
      return ok({ title });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_page_source",
  "Get the page HTML source",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const source = selenium.getPageSource(params.sessionId);
      return ok({ source });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_go_back",
  "Navigate to the previous page",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.goBack(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_go_forward",
  "Navigate to the next page",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.goForward(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_refresh",
  "Refresh the current page",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.refresh(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_execute_script",
  "Execute JavaScript code",
  {
    sessionId: SessionIdSchema,
    script: z.string().describe("JavaScript code to execute"),
  },
  async (params) => {
    try {
      const result = selenium.executeScript(params.sessionId, params.script);
      return ok({ result });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_take_screenshot",
  "Take a screenshot and return as base64",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const screenshot = selenium.takeScreenshot(params.sessionId);
      return ok({ screenshot });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_quit_session",
  "Close the WebDriver session",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.quitSession(params.sessionId);
      return ok({ success: true, sessionId: params.sessionId });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_switch_to_window",
  "Switch to a different window",
  {
    sessionId: SessionIdSchema,
    windowHandle: z.string().describe("Window handle"),
  },
  async (params) => {
    try {
      selenium.switchToWindow(params.sessionId, params.windowHandle);
      return ok({ success: true, window: params.windowHandle });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_window_handles",
  "Get all window handles",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const handles = selenium.getWindowHandles(params.sessionId);
      return ok({ handles, count: handles.length });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_switch_to_frame",
  "Switch to an iframe",
  {
    sessionId: SessionIdSchema,
    frameLocator: z
      .union([z.number(), LocatorSchema])
      .describe("Frame index or locator"),
  },
  async (params) => {
    try {
      if (typeof params.frameLocator === "number") {
        selenium.switchToFrame(params.sessionId, params.frameLocator);
      } else {
        selenium.switchToFrame(
          params.sessionId,
          params.frameLocator.strategy,
          params.frameLocator.value
        );
      }
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_switch_to_parent_frame",
  "Switch back to parent frame",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.switchToParentFrame(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_switch_to_default_content",
  "Switch to default page content",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.switchToDefaultContent(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_switch_to_alert",
  "Switch to an alert",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.switchToAlert(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_accept_alert",
  "Accept an alert",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.acceptAlert(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_dismiss_alert",
  "Dismiss an alert",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.dismissAlert(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_alert_text",
  "Get alert text",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const text = selenium.getAlertText(params.sessionId);
      return ok({ text });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_send_alert_keys",
  "Send text to an alert prompt",
  {
    sessionId: SessionIdSchema,
    text: z.string().describe("Text to send"),
  },
  async (params) => {
    try {
      selenium.sendAlertKeys(params.sessionId, params.text);
      return ok({ success: true, text: params.text });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_hover_over_element",
  "Hover over an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.hoverOverElement(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_double_click",
  "Double-click an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.doubleClick(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_right_click",
  "Right-click an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.rightClick(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_drag_and_drop",
  "Drag an element to another",
  {
    sessionId: SessionIdSchema,
    sourceLocator: LocatorSchema,
    targetLocator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.dragAndDrop(
        params.sessionId,
        params.sourceLocator.strategy,
        params.sourceLocator.value,
        params.targetLocator.strategy,
        params.targetLocator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_scroll_into_view",
  "Scroll an element into view",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      selenium.scrollIntoView(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_scroll_by",
  "Scroll the page by amount",
  {
    sessionId: SessionIdSchema,
    xOffset: z.number().describe("Horizontal offset in pixels"),
    yOffset: z.number().describe("Vertical offset in pixels"),
  },
  async (params) => {
    try {
      selenium.scrollBy(params.sessionId, params.xOffset, params.yOffset);
      return ok({ success: true, xOffset: params.xOffset, yOffset: params.yOffset });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_element_size",
  "Get the size of an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const size = selenium.getElementSize(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok(size);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_element_location",
  "Get the location of an element",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      const location = selenium.getElementLocation(
        params.sessionId,
        params.locator.strategy,
        params.locator.value
      );
      return ok(location);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_wait_for_element",
  "Wait for element to be present",
  {
    sessionId: SessionIdSchema,
    locator: LocatorSchema,
    timeoutSeconds: z
      .number()
      .default(10)
      .describe("Timeout in seconds"),
  },
  async (params) => {
    try {
      const found = selenium.waitForElement(
        params.sessionId,
        params.locator.strategy,
        params.locator.value,
        params.timeoutSeconds
      );
      return ok({ found });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_add_cookie",
  "Add a cookie",
  {
    sessionId: SessionIdSchema,
    name: z.string().describe("Cookie name"),
    value: z.string().describe("Cookie value"),
    domain: z.string().optional().describe("Cookie domain"),
    path: z.string().optional().describe("Cookie path"),
    secure: z.boolean().optional().describe("Is secure"),
    httpOnly: z.boolean().optional().describe("Is HTTP only"),
  },
  async (params) => {
    try {
      selenium.addCookie(params.sessionId, {
        name: params.name,
        value: params.value,
        domain: params.domain,
        path: params.path,
        secure: params.secure,
        httpOnly: params.httpOnly,
      });
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_cookie",
  "Get a cookie by name",
  {
    sessionId: SessionIdSchema,
    name: z.string().describe("Cookie name"),
  },
  async (params) => {
    try {
      const cookie = selenium.getCookie(params.sessionId, params.name);
      return ok(cookie);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_get_all_cookies",
  "Get all cookies",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      const cookies = selenium.getAllCookies(params.sessionId);
      return ok({ cookies, count: cookies.length });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_delete_cookie",
  "Delete a cookie by name",
  {
    sessionId: SessionIdSchema,
    name: z.string().describe("Cookie name"),
  },
  async (params) => {
    try {
      selenium.deleteCookie(params.sessionId, params.name);
      return ok({ success: true, name: params.name });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "selenium_delete_all_cookies",
  "Delete all cookies",
  {
    sessionId: SessionIdSchema,
  },
  async (params) => {
    try {
      selenium.deleteAllCookies(params.sessionId);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

// ─── GRID TOOLS ────────────────────────────────────────────────────

server.tool(
  "grid_get_status",
  "Get Selenium Grid status",
  {},
  async () => {
    try {
      const status = grid.getStatus();
      return ok(status);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "grid_get_node_info",
  "Get information about a Grid node",
  {
    nodeUrl: z.string().optional().describe("Node URL"),
  },
  async (params) => {
    try {
      const info = grid.getNodeInfo(params.nodeUrl);
      return ok(info);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "grid_list_sessions",
  "List all active Grid sessions",
  {},
  async () => {
    try {
      const sessions = grid.listSessions();
      return ok({ sessions, count: sessions.length });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "grid_drain_node",
  "Drain a Grid node",
  {
    nodeUrl: z.string().describe("Node URL"),
  },
  async (params) => {
    try {
      grid.drainNode(params.nodeUrl);
      return ok({ success: true, nodeUrl: params.nodeUrl });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "grid_mark_node_unhealthy",
  "Mark a Grid node as unhealthy",
  {
    nodeUrl: z.string().describe("Node URL"),
  },
  async (params) => {
    try {
      grid.markNodeUnhealthy(params.nodeUrl);
      return ok({ success: true, nodeUrl: params.nodeUrl });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "grid_mark_node_healthy",
  "Mark a Grid node as healthy",
  {
    nodeUrl: z.string().describe("Node URL"),
  },
  async (params) => {
    try {
      grid.markNodeHealthy(params.nodeUrl);
      return ok({ success: true, nodeUrl: params.nodeUrl });
    } catch (e) {
      return err(String(e));
    }
  }
);

// ─── TEST RUNNER TOOLS ──────────────────────────────────────────────

server.tool(
  "test_run_junit_tests",
  "Run JUnit tests",
  {
    testPath: z.string().describe("Path to test file or directory"),
    framework: z
      .enum(["junit4", "junit5"])
      .describe("JUnit version"),
  },
  async (params) => {
    try {
      const result = testRunner.runJUnitTests(params.testPath, params.framework);
      return ok(result);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "test_run_testng_tests",
  "Run TestNG tests",
  {
    testPath: z.string().describe("Path to test file or directory"),
  },
  async (params) => {
    try {
      const result = testRunner.runTestNGTests(params.testPath);
      return ok(result);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "test_get_test_results",
  "Get results from last test run",
  {},
  async () => {
    try {
      const results = testRunner.getTestResults();
      return ok(results);
    } catch (e) {
      return err(String(e));
    }
  }
);

// ─── PAGE OBJECT MODEL TOOLS ───────────────────────────────────────

server.tool(
  "pom_generate_page_object",
  "Generate a Page Object Model class",
  {
    pageName: z.string().describe("Name of the page"),
    elements: z
      .array(
        z.object({
          name: z.string().describe("Element name"),
          locator: LocatorSchema,
        })
      )
      .describe("Elements to include"),
    outputPath: z
      .string()
      .describe("Output file path"),
  },
  async (params) => {
    try {
      const code = pom.generatePageObject(
        params.pageName,
        params.elements,
        params.outputPath
      );
      return ok({ success: true, code });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "pom_scaffold_page_object",
  "Scaffold a Page Object Model class with recorded interactions",
  {
    pageName: z.string().describe("Name of the page"),
    recordingName: z.string().describe("Name of the recording"),
    outputPath: z
      .string()
      .describe("Output file path"),
  },
  async (params) => {
    try {
      const code = pom.scaffoldPageObject(
        params.pageName,
        params.recordingName,
        params.outputPath
      );
      return ok({ success: true, code });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "pom_add_page_element",
  "Add an element to a Page Object Model",
  {
    pomPath: z.string().describe("Path to POM file"),
    elementName: z.string().describe("Element name"),
    locator: LocatorSchema,
  },
  async (params) => {
    try {
      pom.addPageElement(params.pomPath, params.elementName, params.locator);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "pom_add_page_method",
  "Add a method to a Page Object Model",
  {
    pomPath: z.string().describe("Path to POM file"),
    methodName: z.string().describe("Method name"),
    methodBody: z.string().describe("Method implementation"),
  },
  async (params) => {
    try {
      pom.addPageMethod(params.pomPath, params.methodName, params.methodBody);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

// ─── INTELLIJ TOOLS ────────────────────────────────────────────────

server.tool(
  "intellij_open_file",
  "Open a file in IntelliJ",
  {
    filePath: z.string().describe("File path to open"),
    line: z.number().optional().describe("Line number to go to"),
    column: z.number().optional().describe("Column number"),
  },
  async (params) => {
    try {
      intellij.openFile(params.filePath, params.line, params.column);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_navigate_to_symbol",
  "Navigate to a symbol in IntelliJ",
  {
    symbol: z.string().describe("Symbol name or qualified name"),
  },
  async (params) => {
    try {
      intellij.navigateToSymbol(params.symbol);
      return ok({ success: true, symbol: params.symbol });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_refactor_rename",
  "Rename a symbol in IntelliJ",
  {
    symbolName: z.string().describe("Current symbol name"),
    newName: z.string().describe("New symbol name"),
  },
  async (params) => {
    try {
      intellij.refactorRename(params.symbolName, params.newName);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_extract_method",
  "Extract method in IntelliJ",
  {
    methodName: z.string().describe("New method name"),
  },
  async (params) => {
    try {
      intellij.extractMethod(params.methodName);
      return ok({ success: true, methodName: params.methodName });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_run_configuration",
  "Run a configuration in IntelliJ",
  {
    configName: z.string().describe("Configuration name"),
  },
  async (params) => {
    try {
      intellij.runConfiguration(params.configName);
      return ok({ success: true, configName: params.configName });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_debug_configuration",
  "Debug a configuration in IntelliJ",
  {
    configName: z.string().describe("Configuration name"),
  },
  async (params) => {
    try {
      intellij.debugConfiguration(params.configName);
      return ok({ success: true, configName: params.configName });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_get_project_structure",
  "Get the project structure from IntelliJ",
  {},
  async () => {
    try {
      const structure = intellij.getProjectStructure();
      return ok(structure);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_build_project",
  "Build the project in IntelliJ",
  {},
  async () => {
    try {
      intellij.buildProject();
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_rebuild_project",
  "Rebuild the project in IntelliJ",
  {},
  async () => {
    try {
      intellij.rebuildProject();
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_clean_project",
  "Clean the project in IntelliJ",
  {},
  async () => {
    try {
      intellij.cleanProject();
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_commit_changes",
  "Commit changes in IntelliJ",
  {
    message: z.string().describe("Commit message"),
  },
  async (params) => {
    try {
      intellij.commitChanges(params.message);
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_push_changes",
  "Push changes in IntelliJ",
  {},
  async () => {
    try {
      intellij.pushChanges();
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "intellij_pull_changes",
  "Pull changes in IntelliJ",
  {},
  async () => {
    try {
      intellij.pullChanges();
      return ok({ success: true });
    } catch (e) {
      return err(String(e));
    }
  }
);

// ─── RECORDING TOOLS ───────────────────────────────────────────────

server.tool(
  "recording_start",
  "Start recording user interactions",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      recorder.startRecording(params.name);
      return ok({ success: true, recordingName: params.name });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_stop",
  "Stop the current recording",
  {},
  async () => {
    try {
      const recording = recorder.stopRecording();
      return ok(recording);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_list",
  "List all saved recordings",
  {},
  async () => {
    try {
      const recordings = recorder.listRecordings();
      return ok({ recordings, count: recordings.length });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_get_events",
  "Get events from a recording",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      const events = recorder.getRecordingEvents(params.name);
      return ok({ recordingName: params.name, events, count: events.length });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_delete",
  "Delete a recording",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      recorder.deleteRecording(params.name);
      return ok({ success: true, recordingName: params.name });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_export_to_json",
  "Export a recording to JSON format",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      const jsonFormat = recorder.exportToJson(params.name);
      return ok(jsonFormat);
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_export_to_python",
  "Export a recording to Python Selenium code",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      const pythonCode = recorder.exportToPython(params.name);
      return ok({ code: pythonCode });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_export_to_javascript",
  "Export a recording to JavaScript Selenium code",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      const jsCode = recorder.exportToJavaScript(params.name);
      return ok({ code: jsCode });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_export_to_java",
  "Export a recording to Java Selenium code",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      const javaCode = recorder.exportToJava(params.name);
      return ok({ code: javaCode });
    } catch (e) {
      return err(String(e));
    }
  }
);

server.tool(
  "recording_export_to_side",
  "Export a recording to Selenium IDE format",
  {
    name: z.string().describe("Recording name"),
  },
  async (params) => {
    try {
      const sideFormat = recorder.exportToSide(params.name);
      return ok(sideFormat);
    } catch (e) {
      return err(String(e));
    }
  }
);

// ─── Start Server ────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);