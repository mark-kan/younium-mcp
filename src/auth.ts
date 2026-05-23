const TOKEN_URL = "https://auth.younium.com/connect/token";
const REFRESH_BUFFER_SECS = 60;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export async function getToken(): Promise<string> {
  const now = Date.now() / 1000;
  if (cached && cached.expiresAt > now + REFRESH_BUFFER_SECS) {
    return cached.value;
  }

  const body = new URLSearchParams({
    grant_type: "password",
    scope: "youniumapi",
    username: getEnv("YOUNIUM_USERNAME"),
    password: getEnv("YOUNIUM_PASSWORD"),
    client_id: getEnv("YOUNIUM_CLIENT_ID"),
    client_secret: getEnv("YOUNIUM_CLIENT_SECRET"),
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Younium auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  cached = { value: data.access_token, expiresAt: now + data.expires_in };
  return cached.value;
}
