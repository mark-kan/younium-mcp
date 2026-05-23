import { getToken } from "./auth.js";

const BASE_URL = "https://api.younium.com";
const API_VERSION = "2.1";

export async function request(
  method: string,
  path: string,
  query: Record<string, string>,
  body: unknown | null,
  idempotencyKey?: string
): Promise<unknown> {
  const token = await getToken();

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "api-version": API_VERSION,
    Accept: "application/json",
  };

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  if (idempotencyKey) {
    headers["younium-idempotency-key"] = idempotencyKey;
  }

  const legalEntity = process.env.YOUNIUM_LEGAL_ENTITY;
  if (legalEntity) {
    headers["legal-entity"] = legalEntity;
  }

  const res = await fetch(url.toString(), {
    method: method.toUpperCase(),
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    return { error: true, status: res.status, body: text };
  }

  if (!text) return { success: true };

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
