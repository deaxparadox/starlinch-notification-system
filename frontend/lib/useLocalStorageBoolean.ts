"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, callback: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.get(key)?.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

/** Reads/writes a boolean localStorage flag, synced properly via useSyncExternalStore (the
 * React-recommended way to read an external, client-only data source without a setState-in-
 * effect render). Server snapshot is always `false` since localStorage doesn't exist there -
 * the real value applies on the client right after hydration. */
export function useLocalStorageBoolean(key: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    useCallback(() => getSnapshot(key), [key]),
    getServerSnapshot,
  );

  const setValue = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Per-viewer convenience only - fine if it doesn't persist.
      }
      notify(key);
    },
    [key],
  );

  return [value, setValue];
}
