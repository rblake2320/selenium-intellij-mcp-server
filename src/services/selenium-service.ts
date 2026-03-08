/**
 * Selenium WebDriver service — manages browser sessions and WebDriver commands.
 * Uses the selenium-webdriver npm package (same W3C WebDriver protocol as Java Selenium).
 */

import { Builder, By, Key, until, WebDriver, WebElement, logging } from "selenium-webdriver";
import type { Options as ChromeOptions } from "selenium-webdriver/chrome.js";
import type { SessionInfo, ElementLocator, ElementInfo, CookieInfo, ScreenshotResult } from "../types.js";
import { DEFAULT_TIMEOUT, DEFAULT_IMPLICIT_WAIT, DEFAULT_PAGE_LOAD_TIMEOUT, DEFAULT_SCRIPT_TIMEOUT } from "../constants.js";
import type { SupportedBrowser, LocatorStrategy } from "../constants.js";

/** Active WebDriver sessions indexed by session ID */
const sessions = new Map<string, { driver: WebDriver; info: SessionInfo }>();

// ─── Locator Mapping ──────────────────────────────────────────────

function toBy(strategy: LocatorStrategy, value: string): By {
  switch (strategy) {
    case "id": return By.id(value);
    case "name": return By.name(value);
    case "className": return By.className(value);
    case "tagName": return By.tagName(value);
    case "css": return By.css(value);
    case "xpath": return By.xpath(value);
    case "linkText": return By.linkText(value);
    case "partialLinkText": return By.partialLinkText(value);
    default: throw new Error(`Unknown locator strategy: ${strategy}`);
  }
}

// ─── Session Management ───────────────────────────────────────────

export async function createSession(
  browser: SupportedBrowser,
  options?: {
    headless?: boolean;
    gridUrl?: string;
    windowSize?: { width: number; height: number };
    arguments?: string[];
  }
): Promise<SessionInfo> {
  let builder = new Builder().forBrowser(browser);

  if (options?.gridUrl) {
    builder = builder.usingServer(options.gridUrl);
  }

  // Browser-specific options
  if (browser === "chrome") {
    const { Options } = await import("selenium-webdriver/chrome.js");
    const chromeOpts = new Options();
    if (options?.headless) chromeOpts.addArguments("--headless=new");
    if (options?.arguments) chromeOpts.addArguments(...options.arguments);
    chromeOpts.addArguments("--no-sandbox", "--disable-dev-shm-usage");
    builder.setChromeOptions(chromeOpts);
  } else if (browser === "firefox") {
    const { Options } = await import("selenium-webdriver/firefox.js");
    const firefoxOpts = new Options();
    if (options?.headless) firefoxOpts.addArguments("--headless");
    builder.setFirefoxOptions(firefoxOpts);
  } else if (browser === "edge") {
    const { Options } = await import("selenium-webdriver/edge.js");
    const edgeOpts = new Options();
    if (options?.headless) edgeOpts.addArguments("--headless=new");
    builder.setEdgeOptions(edgeOpts);
  }

  const driver = await builder.build();

  // Set timeouts
  await driver.manage().setTimeouts({
    implicit: options?.gridUrl ? DEFAULT_IMPLICIT_WAIT : DEFAULT_IMPLICIT_WAIT,
    pageLoad: DEFAULT_PAGE_LOAD_TIMEOUT,
    script: DEFAULT_SCRIPT_TIMEOUT
  });

  if (options?.windowSize) {
    await driver.manage().window().setRect({
      width: options.windowSize.width,
      height: options.windowSize.height
    });
  }

  const session = await driver.getSession();
  const sessionId = session.getId();
  const capabilities = session.getCapabilities();

  const info: SessionInfo = {
    sessionId,
    browser,
    capabilities: Object.fromEntries(
      (capabilities as unknown as Map<string, unknown>).entries?.() ?? []
    ),
    createdAt: new Date().toISOString(),
    gridNodeUrl: options?.gridUrl
  };

  sessions.set(sessionId, { driver, info });
  return info;
}

export function getSession(sessionId: string): { driver: WebDriver; info: SessionInfo } {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session '${sessionId}' not found. Active sessions: ${[...sessions.keys()].join(", ") || "none"}`);
  return session;
}

export function listSessions(): SessionInfo[] {
  return [...sessions.values()].map(s => s.info);
}

export async function closeSession(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  await session.driver.quit();
  sessions.delete(sessionId);
}

export async function closeAllSessions(): Promise<number> {
  let count = 0;
  for (const [id, session] of sessions) {
    try {
      await session.driver.quit();
      count++;
    } catch { /* session already closed */ }
    sessions.delete(id);
  }
  return count;
}

// ─── Navigation ───────────────────────────────────────────────────

export async function navigate(sessionId: string, url: string): Promise<string> {
  const { driver } = getSession(sessionId);
  await driver.get(url);
  return driver.getCurrentUrl();
}

export async function navigateBack(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.navigate().back();
}

export async function navigateForward(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.navigate().forward();
}

export async function refresh(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.navigate().refresh();
}

export async function getCurrentUrl(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  return driver.getCurrentUrl();
}

export async function getTitle(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  return driver.getTitle();
}

export async function getPageSource(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  return driver.getPageSource();
}

// ─── Element Interaction ──────────────────────────────────────────

async function findElement(sessionId: string, locator: ElementLocator): Promise<WebElement> {
  const { driver } = getSession(sessionId);
  const by = toBy(locator.strategy, locator.value);
  return driver.findElement(by);
}

async function findElements(sessionId: string, locator: ElementLocator): Promise<WebElement[]> {
  const { driver } = getSession(sessionId);
  const by = toBy(locator.strategy, locator.value);
  return driver.findElements(by);
}

export async function click(sessionId: string, locator: ElementLocator): Promise<void> {
  const el = await findElement(sessionId, locator);
  await el.click();
}

export async function doubleClick(sessionId: string, locator: ElementLocator): Promise<void> {
  const { driver } = getSession(sessionId);
  const el = await findElement(sessionId, locator);
  const actions = driver.actions({ async: true });
  await actions.doubleClick(el).perform();
}

export async function rightClick(sessionId: string, locator: ElementLocator): Promise<void> {
  const { driver } = getSession(sessionId);
  const el = await findElement(sessionId, locator);
  const actions = driver.actions({ async: true });
  await actions.contextClick(el).perform();
}

export async function hover(sessionId: string, locator: ElementLocator): Promise<void> {
  const { driver } = getSession(sessionId);
  const el = await findElement(sessionId, locator);
  const actions = driver.actions({ async: true });
  await actions.move({ origin: el }).perform();
}

export async function type(sessionId: string, locator: ElementLocator, text: string, clearFirst = true): Promise<void> {
  const el = await findElement(sessionId, locator);
  if (clearFirst) await el.clear();
  await el.sendKeys(text);
}

export async function sendKeys(sessionId: string, locator: ElementLocator, keys: string[]): Promise<void> {
  const el = await findElement(sessionId, locator);
  const keyMap: Record<string, string> = {
    ENTER: Key.ENTER, TAB: Key.TAB, ESCAPE: Key.ESCAPE,
    BACKSPACE: Key.BACK_SPACE, DELETE: Key.DELETE,
    ARROW_UP: Key.ARROW_UP, ARROW_DOWN: Key.ARROW_DOWN,
    ARROW_LEFT: Key.ARROW_LEFT, ARROW_RIGHT: Key.ARROW_RIGHT,
    CONTROL: Key.CONTROL, SHIFT: Key.SHIFT, ALT: Key.ALT,
    SPACE: Key.SPACE, HOME: Key.HOME, END: Key.END,
    PAGE_UP: Key.PAGE_UP, PAGE_DOWN: Key.PAGE_DOWN,
  };
  const resolved = keys.map(k => keyMap[k.toUpperCase()] ?? k);
  await el.sendKeys(...resolved);
}

export async function clear(sessionId: string, locator: ElementLocator): Promise<void> {
  const el = await findElement(sessionId, locator);
  await el.clear();
}

export async function submit(sessionId: string, locator: ElementLocator): Promise<void> {
  const el = await findElement(sessionId, locator);
  await el.submit();
}

export async function selectByValue(sessionId: string, locator: ElementLocator, value: string): Promise<void> {
  const el = await findElement(sessionId, locator);
  const options = await el.findElements(By.css(`option[value="${value}"]`));
  if (options.length === 0) throw new Error(`No option with value '${value}' found`);
  await options[0].click();
}

export async function selectByText(sessionId: string, locator: ElementLocator, text: string): Promise<void> {
  const el = await findElement(sessionId, locator);
  const options = await el.findElements(By.xpath(`.//option[normalize-space(.)="${text}"]`));
  if (options.length === 0) throw new Error(`No option with text '${text}' found`);
  await options[0].click();
}

export async function uploadFile(sessionId: string, locator: ElementLocator, filePath: string): Promise<void> {
  const el = await findElement(sessionId, locator);
  await el.sendKeys(filePath);
}

// ─── Element Query ────────────────────────────────────────────────

export async function getText(sessionId: string, locator: ElementLocator): Promise<string> {
  const el = await findElement(sessionId, locator);
  return el.getText();
}

export async function getAttribute(sessionId: string, locator: ElementLocator, attribute: string): Promise<string | null> {
  const el = await findElement(sessionId, locator);
  return el.getAttribute(attribute);
}

export async function getCssValue(sessionId: string, locator: ElementLocator, property: string): Promise<string> {
  const el = await findElement(sessionId, locator);
  return el.getCssValue(property);
}

export async function getElementInfo(sessionId: string, locator: ElementLocator): Promise<ElementInfo> {
  const el = await findElement(sessionId, locator);
  const [tagName, text, isDisplayed, isEnabled, isSelected, rect] = await Promise.all([
    el.getTagName(), el.getText(), el.isDisplayed(), el.isEnabled(), el.isSelected(), el.getRect()
  ]);

  // Get common attributes
  const attrNames = ["id", "name", "class", "type", "value", "href", "src", "placeholder", "aria-label", "data-testid"];
  const attributes: Record<string, string> = {};
  for (const attr of attrNames) {
    const val = await el.getAttribute(attr);
    if (val) attributes[attr] = val;
  }

  return {
    tagName, text, attributes, isDisplayed, isEnabled, isSelected,
    location: { x: rect.x, y: rect.y },
    size: { width: rect.width, height: rect.height }
  };
}

export async function findElementsInfo(sessionId: string, locator: ElementLocator): Promise<ElementInfo[]> {
  const elements = await findElements(sessionId, locator);
  const results: ElementInfo[] = [];
  for (const el of elements.slice(0, 50)) { // Cap at 50 to avoid huge responses
    const [tagName, text, isDisplayed, isEnabled, isSelected, rect] = await Promise.all([
      el.getTagName(), el.getText(), el.isDisplayed(), el.isEnabled(), el.isSelected(), el.getRect()
    ]);
    results.push({
      tagName, text, attributes: {}, isDisplayed, isEnabled, isSelected,
      location: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height }
    });
  }
  return results;
}

export async function isElementPresent(sessionId: string, locator: ElementLocator): Promise<boolean> {
  try {
    const elements = await findElements(sessionId, locator);
    return elements.length > 0;
  } catch { return false; }
}

// ─── Waits ────────────────────────────────────────────────────────

export async function waitForElement(sessionId: string, locator: ElementLocator, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const { driver } = getSession(sessionId);
  const by = toBy(locator.strategy, locator.value);
  await driver.wait(until.elementLocated(by), timeout);
}

export async function waitForElementVisible(sessionId: string, locator: ElementLocator, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const { driver } = getSession(sessionId);
  const by = toBy(locator.strategy, locator.value);
  const el = await driver.findElement(by);
  await driver.wait(until.elementIsVisible(el), timeout);
}

export async function waitForElementClickable(sessionId: string, locator: ElementLocator, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const { driver } = getSession(sessionId);
  const by = toBy(locator.strategy, locator.value);
  const el = await driver.findElement(by);
  await driver.wait(until.elementIsEnabled(el), timeout);
}

export async function waitForTitle(sessionId: string, title: string, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.wait(until.titleContains(title), timeout);
}

export async function waitForUrl(sessionId: string, urlFragment: string, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.wait(until.urlContains(urlFragment), timeout);
}

// ─── Screenshots ──────────────────────────────────────────────────

export async function takeScreenshot(sessionId: string): Promise<ScreenshotResult> {
  const { driver } = getSession(sessionId);
  const base64 = await driver.takeScreenshot();
  return { base64, format: "png", timestamp: new Date().toISOString() };
}

// ─── JavaScript Execution ─────────────────────────────────────────

export async function executeScript(sessionId: string, script: string, args: unknown[] = []): Promise<unknown> {
  const { driver } = getSession(sessionId);
  return driver.executeScript(script, ...args);
}

export async function executeAsyncScript(sessionId: string, script: string, args: unknown[] = []): Promise<unknown> {
  const { driver } = getSession(sessionId);
  return driver.executeAsyncScript(script, ...args);
}

// ─── Cookies ──────────────────────────────────────────────────────

export async function getCookies(sessionId: string): Promise<CookieInfo[]> {
  const { driver } = getSession(sessionId);
  const cookies = await driver.manage().getCookies();
  return cookies.map(c => ({
    name: c.name, value: c.value, domain: c.domain,
    path: c.path, expiry: c.expiry instanceof Date ? c.expiry.getTime() : c.expiry, secure: c.secure,
    httpOnly: c.httpOnly, sameSite: c.sameSite
  })) as CookieInfo[];
}

export async function addCookie(sessionId: string, cookie: CookieInfo): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.manage().addCookie(cookie);
}

export async function deleteCookie(sessionId: string, name: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.manage().deleteCookie(name);
}

export async function deleteAllCookies(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.manage().deleteAllCookies();
}

// ─── Frames & Windows ─────────────────────────────────────────────

export async function switchToFrame(sessionId: string, identifier: string | number): Promise<void> {
  const { driver } = getSession(sessionId);
  if (typeof identifier === "number") {
    await driver.switchTo().frame(identifier);
  } else {
    const el = await driver.findElement(By.css(identifier));
    await driver.switchTo().frame(el);
  }
}

export async function switchToDefaultContent(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.switchTo().defaultContent();
}

export async function getWindowHandles(sessionId: string): Promise<string[]> {
  const { driver } = getSession(sessionId);
  return driver.getAllWindowHandles();
}

export async function switchToWindow(sessionId: string, handle: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.switchTo().window(handle);
}

export async function openNewTab(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  await driver.switchTo().newWindow("tab");
  return driver.getWindowHandle();
}

export async function closeCurrentTab(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.close();
}

export async function setWindowSize(sessionId: string, width: number, height: number): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.manage().window().setRect({ width, height });
}

export async function maximizeWindow(sessionId: string): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.manage().window().maximize();
}

// ─── Alerts ───────────────────────────────────────────────────────

export async function acceptAlert(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  const alert = await driver.switchTo().alert();
  const text = await alert.getText();
  await alert.accept();
  return text;
}

export async function dismissAlert(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  const alert = await driver.switchTo().alert();
  const text = await alert.getText();
  await alert.dismiss();
  return text;
}

export async function getAlertText(sessionId: string): Promise<string> {
  const { driver } = getSession(sessionId);
  const alert = await driver.switchTo().alert();
  return alert.getText();
}

export async function sendAlertText(sessionId: string, text: string): Promise<void> {
  const { driver } = getSession(sessionId);
  const alert = await driver.switchTo().alert();
  await alert.sendKeys(text);
}

// ─── Console Logs ─────────────────────────────────────────────────

export async function getConsoleLogs(sessionId: string, level = "ALL"): Promise<Array<{ level: string; message: string; timestamp: number }>> {
  const { driver } = getSession(sessionId);
  try {
    const logs = await driver.manage().logs().get("browser");
    return logs.map((entry: { level: { name: string }; message: string; timestamp: number }) => ({
      level: entry.level.name,
      message: entry.message,
      timestamp: entry.timestamp
    }));
  } catch {
    return [{ level: "INFO", message: "Console log access not supported by this browser/driver", timestamp: Date.now() }];
  }
}

// ─── Drag and Drop ────────────────────────────────────────────────

export async function dragAndDrop(sessionId: string, source: ElementLocator, target: ElementLocator): Promise<void> {
  const { driver } = getSession(sessionId);
  const sourceEl = await findElement(sessionId, source);
  const targetEl = await findElement(sessionId, target);
  const actions = driver.actions({ async: true });
  await actions.dragAndDrop(sourceEl, targetEl).perform();
}

// ─── Scrolling ────────────────────────────────────────────────────

export async function scrollToElement(sessionId: string, locator: ElementLocator): Promise<void> {
  const el = await findElement(sessionId, locator);
  const { driver } = getSession(sessionId);
  await driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", el);
}

export async function scrollBy(sessionId: string, x: number, y: number): Promise<void> {
  const { driver } = getSession(sessionId);
  await driver.executeScript(`window.scrollBy(${x}, ${y});`);
}