// Token + user storage.
// sessionStorage (not localStorage): session ends when the tab closes — better
// hygiene for access tokens than persistent storage.

const TOKEN_KEY = "ai-cs.token";
const USER_KEY = "ai-cs.user";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: unknown) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getUser<T = unknown>(): T | null {
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function isAuthed(): boolean {
  return !!getToken();
}
