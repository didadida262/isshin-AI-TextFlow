import { invoke } from "@tauri-apps/api/core";
import type { AuthUser } from "../types";

const AUTH_KEY = "textflow-auth";

interface RawUserSession {
  id: number;
  username: string;
  displayName: string;
}

function mapUser(raw: RawUserSession): AuthUser {
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.displayName,
  };
}

export function readAuthSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function writeAuthSession(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_KEY);
}

export async function login(
  username: string,
  password: string,
): Promise<AuthUser> {
  const session = await invoke<RawUserSession>("login", {
    username: username.trim(),
    password,
  });
  const user = mapUser(session);
  writeAuthSession(user);
  return user;
}

export function logout(): void {
  clearAuthSession();
}
