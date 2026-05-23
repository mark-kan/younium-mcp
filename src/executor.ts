import { request } from "./client.js";
import type { ToolDefinition } from "./spec-loader.js";

export async function execute(
  tool: ToolDefinition,
  args: Record<string, unknown>
): Promise<string> {
  // Substitute path parameters
  let urlPath = tool.pathTemplate;
  for (const param of tool.pathParams) {
    const val = args[param];
    if (val === undefined || val === null) {
      return JSON.stringify({ error: `Missing required path parameter: ${param}` });
    }
    urlPath = urlPath.replace(`{${param}}`, encodeURIComponent(String(val)));
  }

  // Collect query params
  const query: Record<string, string> = {};
  for (const param of tool.queryParams) {
    const val = args[param];
    if (val !== undefined && val !== null) {
      query[param] = String(val);
    }
  }

  // Build body: everything that isn't a path or query param
  let body: unknown | null = null;
  if (tool.hasBody) {
    const paramSet = new Set([...tool.pathParams, ...tool.queryParams]);
    const bodyFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (!paramSet.has(k) && v !== undefined) {
        bodyFields[k] = v;
      }
    }
    body = Object.keys(bodyFields).length > 0 ? bodyFields : null;
  }

  const idempotencyKey =
    typeof args["younium-idempotency-key"] === "string"
      ? args["younium-idempotency-key"]
      : undefined;

  try {
    const result = await request(tool.method, urlPath, query, body, idempotencyKey);
    return JSON.stringify(result, null, 2);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
