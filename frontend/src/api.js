// Set VITE_API_URL in your frontend's .env when the backend runs
// somewhere other than localhost:4000 (e.g. once it's deployed).
export const API_BASE = import.meta.env?.VITE_API_URL || "export const API_BASE = import.meta.env?.VITE_API_URL || "https://manzili-app.onrender.com";

function authHeaders() {
  const token = localStorage.getItem("manzili_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest(path, { method = "GET", body, auth = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? authHeaders() : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export function saveSession(token, user) {
  localStorage.setItem("manzili_token", token);
  localStorage.setItem("manzili_user", JSON.stringify(user));
}

export function loadSession() {
  const token = localStorage.getItem("manzili_token");
  const userRaw = localStorage.getItem("manzili_user");
  if (!token || !userRaw) return null;
  try {
    return { token, user: JSON.parse(userRaw) };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("manzili_token");
  localStorage.removeItem("manzili_user");
}
