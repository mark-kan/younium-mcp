const TOKEN_URL = "https://api.younium.com/auth/token";
const REFRESH_BUFFER_SECS = 300;

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
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

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: getEnv("YOUNIUM_CLIENT_ID"),
      secret: getEnv("YOUNIUM_SECRET"),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Younium auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  cached = { value: data.accessToken, expiresAt: now + data.expiresIn };
  return cached.value;
}
