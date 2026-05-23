import * as fs from "fs";
import * as path from "path";

interface OpenApiSpec {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, JsonSchema>;
  };
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema }>;
  };
}

interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

interface JsonSchema {
  type?: string;
  format?: string;
  description?: string;
  nullable?: boolean;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: JsonSchema | boolean;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  $ref?: string;
  enum?: unknown[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  method: string;
  pathTemplate: string;
  pathParams: string[];
  queryParams: string[];
  hasBody: boolean;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

function operationIdToName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
}

function resolveRef(ref: string, spec: OpenApiSpec): JsonSchema {
  const parts = ref.replace(/^#\//, "").split("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = spec;
  for (const p of parts) {
    cur = cur[p];
    if (cur === undefined) return {};
  }
  return cur as JsonSchema;
}

function resolveSchema(schema: JsonSchema, spec: OpenApiSpec, depth = 0): JsonSchema {
  if (depth > 6) return { type: "object" };

  if (schema.$ref) {
    return resolveSchema(resolveRef(schema.$ref, spec), spec, depth + 1);
  }

  const out: JsonSchema = { ...schema };
  delete out.$ref;

  if (out.nullable) {
    delete out.nullable;
  }

  if (out.properties) {
    const resolved: Record<string, JsonSchema> = {};
    for (const [k, v] of Object.entries(out.properties)) {
      resolved[k] = resolveSchema(v, spec, depth + 1);
    }
    out.properties = resolved;
  }

  if (out.items) {
    out.items = resolveSchema(out.items, spec, depth + 1);
  }

  if (out.allOf) {
    const merged = mergeAllOf(out.allOf, spec, depth);
    delete out.allOf;
    Object.assign(out, merged);
  }

  if (out.oneOf) {
    out.oneOf = out.oneOf.map((s) => resolveSchema(s, spec, depth + 1));
  }

  if (out.anyOf) {
    out.anyOf = out.anyOf.map((s) => resolveSchema(s, spec, depth + 1));
  }

  return out;
}

function mergeAllOf(
  schemas: JsonSchema[],
  spec: OpenApiSpec,
  depth: number
): JsonSchema {
  const merged: JsonSchema = { type: "object", properties: {}, required: [] };
  for (const s of schemas) {
    const resolved = resolveSchema(s, spec, depth + 1);
    if (resolved.properties) {
      Object.assign(merged.properties!, resolved.properties);
    }
    if (resolved.required) {
      merged.required = [...(merged.required ?? []), ...resolved.required];
    }
    if (resolved.type && resolved.type !== "object") {
      merged.type = resolved.type;
    }
  }
  if (!merged.properties || Object.keys(merged.properties).length === 0) {
    delete merged.properties;
  }
  if (!merged.required || merged.required.length === 0) {
    delete merged.required;
  }
  return merged;
}

function paramSchema(param: OpenApiParameter, spec: OpenApiSpec): JsonSchema {
  const base = param.schema ? resolveSchema(param.schema, spec) : { type: "string" };
  if (param.description) {
    base.description = param.description;
  }
  return base;
}

export function loadTools(): ToolDefinition[] {
  const specPath = path.join(__dirname, "..", "spec", "youniumv2-prod.json");
  const raw = fs.readFileSync(specPath, "utf-8");
  const spec: OpenApiSpec = JSON.parse(raw);

  const tools: ToolDefinition[] = [];
  const seen = new Set<string>();

  for (const [pathTemplate, methods] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = methods[method] as OpenApiOperation | undefined;
      if (!op) continue;

      const rawId = op.operationId ?? `${method}_${pathTemplate.replace(/[^a-zA-Z0-9]/g, "_")}`;
      let name = operationIdToName(rawId);

      // Enforce 64-char limit then deduplicate
      if (name.length > 64) {
        name = name.slice(0, 64).replace(/_+$/, "");
      }
      if (seen.has(name)) {
        const suffix = `_${method}`;
        name = name.slice(0, 64 - suffix.length).replace(/_+$/, "") + suffix;
      }
      seen.add(name);

      const description = [op.summary, op.description]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 400);

      const params = (op.parameters ?? []).filter(
        (p) => p.in !== "header"
      );

      const pathParams = params
        .filter((p) => p.in === "path")
        .map((p) => p.name);

      const queryParams = params
        .filter((p) => p.in === "query")
        .map((p) => p.name);

      // Build combined input schema
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const p of params) {
        properties[p.name] = paramSchema(p, spec);
        if (p.required) required.push(p.name);
      }

      let hasBody = false;
      if (op.requestBody?.content) {
        const jsonContent =
          op.requestBody.content["application/json"] ??
          op.requestBody.content["application/merge-patch+json"] ??
          Object.values(op.requestBody.content)[0];

        if (jsonContent?.schema) {
          const bodySchema = resolveSchema(jsonContent.schema, spec);

          if (bodySchema.properties) {
            for (const [k, v] of Object.entries(bodySchema.properties)) {
              properties[k] = v;
            }
            if (bodySchema.required) {
              required.push(
                ...bodySchema.required.filter((r) => !required.includes(r))
              );
            }
          } else {
            // Scalar or array body — wrap it
            properties["body"] = bodySchema;
          }
          hasBody = true;
        }
      }

      const inputSchema: JsonSchema = { type: "object", properties };
      if (required.length > 0) inputSchema.required = required;

      tools.push({
        name,
        description,
        inputSchema,
        method,
        pathTemplate,
        pathParams,
        queryParams,
        hasBody,
      });
    }
  }

  return tools;
}
