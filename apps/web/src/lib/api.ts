const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export function isApiConfigured(): boolean {
  return Boolean(API_URL);
}

export async function callTool<T>(
  toolName: string,
  input: unknown
): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["X-API-Key"] = API_KEY;

  const res = await fetch(`${API_URL}/api/tools/${toolName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}
