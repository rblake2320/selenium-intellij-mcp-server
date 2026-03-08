/**
 * IntelliJ IDEA integration service.
 * Communicates via IntelliJ's built-in REST API (port 63342) and
 * the IDE Index MCP plugin's HTTP endpoint (port 29170).
 */

import axios, { AxiosError } from "axios";
import type { IntelliJFileInfo, IntelliJRunConfig, IntelliJProjectInfo } from "../types.js";
import { INTELLIJ_DEFAULT_PORT, INTELLIJ_MCP_PORT } from "../constants.js";

let idePort = INTELLIJ_DEFAULT_PORT;
let mcpPort = INTELLIJ_MCP_PORT;

export function setIdePorts(restPort?: number, indexMcpPort?: number): void {
  if (restPort) idePort = restPort;
  if (indexMcpPort) mcpPort = indexMcpPort;
}

// ─── REST API Helpers ─────────────────────────────────────────────

async function ideRequest<T>(path: string, method: "GET" | "POST" = "GET", data?: unknown): Promise<T> {
  try {
    const response = await axios({
      method,
      url: `http://localhost:${idePort}${path}`,
      data,
      timeout: 10000,
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to IntelliJ IDEA at localhost:${idePort}. ` +
          `Ensure IntelliJ is running with the built-in web server enabled ` +
          `(Settings → Build, Execution, Deployment → Debugger → Built-in Server).`
        );
      }
      throw new Error(`IntelliJ API error (${error.response?.status ?? "unknown"}): ${error.message}`);
    }
    throw error;
  }
}

async function mcpRequest<T>(path: string, method: "GET" | "POST" = "GET", data?: unknown): Promise<T> {
  try {
    const response = await axios({
      method,
      url: `http://localhost:${mcpPort}${path}`,
      data,
      timeout: 10000,
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to IntelliJ MCP plugin at localhost:${mcpPort}. ` +
          `Install the 'IDE Index MCP Server' plugin from JetBrains Marketplace, ` +
          `or use IntelliJ 2025.2+ with built-in MCP support.`
        );
      }
      throw new Error(`IntelliJ MCP plugin error (${error.response?.status ?? "unknown"}): ${error.message}`);
    }
    throw error;
  }
}

// ─── Connection Check ─────────────────────────────────────────────

export async function isIdeConnected(): Promise<boolean> {
  try {
    await axios.get(`http://localhost:${idePort}/api/about`, { timeout: 3000 });
    return true;
  } catch { return false; }
}

export async function isMcpPluginConnected(): Promise<boolean> {
  try {
    await axios.get(`http://localhost:${mcpPort}/status`, { timeout: 3000 });
    return true;
  } catch { return false; }
}

// ─── File Operations ──────────────────────────────────────────────

export async function openFile(filePath: string, line?: number, column?: number): Promise<void> {
  let url = `/api/file/${encodeURIComponent(filePath)}`;
  const params: string[] = [];
  if (line !== undefined) params.push(`line=${line}`);
  if (column !== undefined) params.push(`column=${column}`);
  if (params.length) url += `?${params.join("&")}`;
  await ideRequest(url);
}

export async function getFileErrors(filePath: string): Promise<IntelliJFileInfo> {
  // Uses the IDE Index MCP plugin if available
  try {
    const result = await mcpRequest<{
      diagnostics: Array<{
        severity: string;
        message: string;
        range: { start: { line: number; character: number } };
      }>;
    }>(`/diagnostics?file=${encodeURIComponent(filePath)}`);

    const diagnostics = (result.diagnostics ?? []).map(d => ({
      severity: d.severity as "ERROR" | "WARNING" | "INFO",
      message: d.message,
      line: d.range?.start?.line ?? 0,
      column: d.range?.start?.character ?? 0
    }));

    return {
      path: filePath,
      errors: diagnostics.filter(d => d.severity === "ERROR").length,
      warnings: diagnostics.filter(d => d.severity === "WARNING").length,
      diagnostics
    };
  } catch {
    // Fallback: minimal info
    return { path: filePath, errors: -1, warnings: -1, diagnostics: [] };
  }
}

// ─── Code Navigation ──────────────────────────────────────────────

export async function findDefinition(filePath: string, line: number, column: number): Promise<unknown> {
  return mcpRequest(`/definition?file=${encodeURIComponent(filePath)}&line=${line}&column=${column}`);
}

export async function findReferences(filePath: string, line: number, column: number): Promise<unknown> {
  return mcpRequest(`/references?file=${encodeURIComponent(filePath)}&line=${line}&column=${column}`);
}

export async function findImplementations(filePath: string, line: number, column: number): Promise<unknown> {
  return mcpRequest(`/implementations?file=${encodeURIComponent(filePath)}&line=${line}&column=${column}`);
}

export async function searchSymbol(query: string): Promise<unknown> {
  return mcpRequest(`/symbol?query=${encodeURIComponent(query)}`);
}

export async function getTypeHierarchy(filePath: string, line: number, column: number): Promise<unknown> {
  return mcpRequest(`/typeHierarchy?file=${encodeURIComponent(filePath)}&line=${line}&column=${column}`);
}

export async function getCallHierarchy(filePath: string, line: number, column: number): Promise<unknown> {
  return mcpRequest(`/callHierarchy?file=${encodeURIComponent(filePath)}&line=${line}&column=${column}`);
}

// ─── Run Configurations ───────────────────────────────────────────

export async function getRunConfigurations(): Promise<IntelliJRunConfig[]> {
  try {
    return await ideRequest<IntelliJRunConfig[]>("/api/runConfigurations");
  } catch {
    return [];
  }
}

export async function executeRunConfiguration(name: string): Promise<{ status: string; output: string }> {
  return ideRequest(`/api/run?name=${encodeURIComponent(name)}`, "POST");
}

// ─── Project Info ─────────────────────────────────────────────────

export async function getProjectInfo(): Promise<IntelliJProjectInfo> {
  try {
    return await ideRequest<IntelliJProjectInfo>("/api/project");
  } catch {
    return { name: "unknown", basePath: "", modules: [], sdk: "", openFiles: [] };
  }
}

// ─── Refactoring ──────────────────────────────────────────────────

export async function rename(filePath: string, line: number, column: number, newName: string): Promise<unknown> {
  return mcpRequest("/rename", "POST", {
    file: filePath, line, column, newName
  });
}

// ─── Terminal ─────────────────────────────────────────────────────

export async function runInTerminal(command: string): Promise<void> {
  // Uses the REST API to open a terminal and run a command
  await ideRequest("/api/terminal", "POST", { command });
}