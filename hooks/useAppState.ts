"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "@/lib/storage";
import { STORAGE_KEY, seedState } from "@/lib/pos-constants";
import type { AppState } from "@/types/pos";

export interface UseAppStateResult {
  state: AppState | null;
  update: (updater: (prev: AppState) => AppState) => void;
  loading: boolean;
  saveError: boolean;
}

export function useAppState(enabled: boolean): UseAppStateResult {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Not signed in (or no valid staff profile) yet - Firestore will reject the read anyway,
      // so don't attempt it. Reset to a clean loading state for next time `enabled` flips true.
      setState(null);
      setLoading(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY, true);
        if (!cancelled) setState(JSON.parse(res.value) as AppState);
      } catch {
        const seed = seedState();
        if (!cancelled) setState(seed);
        try {
          await storage.set(STORAGE_KEY, JSON.stringify(seed), true);
        } catch {
          // Ignore: state still renders locally even if the first save failed.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const persist = useCallback((next: AppState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await storage.set(STORAGE_KEY, JSON.stringify(next), true);
      setSaveError(!result);
    }, 250);
  }, []);

  const update = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { state, update, loading, saveError };
}
