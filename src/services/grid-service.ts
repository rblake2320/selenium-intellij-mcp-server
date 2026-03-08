/**
 * Selenium Grid 4 management service — communicates via Grid's REST API.
 */

import axios, { AxiosError } from "axios";
import type { GridStatus, GridNodeInfo } from "../types.js";
import { GRID_DEFAULT_URL } from "../constants.js";

let gridUrl = GRID_DEFAULT_URL;

export function setGridUrl(url: string): void {
  gridUrl = url.replace(/\/$/, "");
}

export function getGridUrl(): string {
  return gridUrl;
}

async function gridRequest<T>(path: string, method: "GET" | "POST" | "DELETE" = "GET", data?: unknown): Promise<T> {
  try {
    const response = await axios({
      method,
      url: `${gridUrl}${path}`,
      data,
      timeout: 15000,
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(`Cannot connect to Selenium Grid at ${gridUrl}. Is the Grid hub running? Start it with: java -jar selenium-server-4.x.jar hub`);
      }
      throw new Error(`Grid API error (${error.response?.status ?? "unknown"}): ${error.response?.data?.message ?? error.message}`);
    }
    throw error;
  }
}

// ─── Grid Status ──────────────────────────────────────────────────

export async function getGridStatus(): Promise<GridStatus> {
  const data = await gridRequest<{ value: { ready: boolean; message: string; nodes: unknown[] } }>("/status");
  const val = data.value;
  return {
    ready: val.ready,
    message: val.message,
    nodes: (val.nodes as GridNodeInfo[]) ?? []
  };
}

export async function isGridReady(): Promise<boolean> {
  try {
    const status = await getGridStatus();
    return status.ready;
  } catch { return false; }
}

// ─── Session Management ───────────────────────────────────────────

export async function getGridSessions(): Promise<Array<{
  id: string;
  capabilities: Record<string, unknown>;
  nodeId: string;
}>> {
  // Grid 4 GraphQL endpoint
  const query = `{ sessionsInfo { sessions { id, capabilities, nodeId } } }`;
  try {
    const data = await gridRequest<{ data: { sessionsInfo: { sessions: unknown[] } } }>(
      "/graphql", "POST", { query }
    );
    return (data.data?.sessionsInfo?.sessions ?? []) as Array<{
      id: string;
      capabilities: Record<string, unknown>;
      nodeId: string;
    }>;
  } catch {
    // Fallback: use status endpoint
    return [];
  }
}

export async function deleteGridSession(sessionId: string): Promise<void> {
  await gridRequest(`/session/${sessionId}`, "DELETE");
}

// ─── Node Management ──────────────────────────────────────────────

export async function getGridNodes(): Promise<GridNodeInfo[]> {
  const status = await getGridStatus();
  return status.nodes;
}

export async function drainNode(nodeId: string): Promise<void> {
  const query = `mutation { removeNode(id: "${nodeId}") }`;
  await gridRequest("/graphql", "POST", { query });
}

// ─── Grid Queue ───────────────────────────────────────────────────

export async function getQueueSize(): Promise<number> {
  const query = `{ grid { sessionQueueSize } }`;
  try {
    const data = await gridRequest<{ data: { grid: { sessionQueueSize: number } } }>(
      "/graphql", "POST", { query }
    );
    return data.data?.grid?.sessionQueueSize ?? 0;
  } catch { return -1; }
}

// ─── Capabilities Check ──────────────────────────────────────────

export async function getAvailableBrowsers(): Promise<Array<{
  browserName: string;
  browserVersion?: string;
  platformName?: string;
  available: number;
}>> {
  const nodes = await getGridNodes();
  const browsers: Array<{
    browserName: string;
    browserVersion?: string;
    platformName?: string;
    available: number;
  }> = [];

  for (const node of nodes) {
    if (node.stereotypes) {
      for (const st of node.stereotypes) {
        const existing = browsers.find(
          b => b.browserName === st.browserName && b.browserVersion === st.browserVersion
        );
        if (existing) {
          existing.available += st.maxInstances;
        } else {
          browsers.push({
            browserName: st.browserName,
            browserVersion: st.browserVersion,
            platformName: st.platformName,
            available: st.maxInstances
          });
        }
      }
    }
  }
  return browsers;
}