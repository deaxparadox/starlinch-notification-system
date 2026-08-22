const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}

/** Raw fetch wrapper: attaches the access token (if given) and always sends the refresh
 * cookie. Does not interpret status codes - callers decide what a given status means for
 * their own request (e.g. 401 on login = wrong password, 401 elsewhere = session expired). */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<Response> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
}
