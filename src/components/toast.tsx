"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * A deliberately plain toast: a ruled black slab in the corner. No icons in
 * coloured circles, no rounded pill. Errors are marked with a magenta edge
 * rather than a second colour system.
 */

type ToastTone = "info" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastApi = {
  toast: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = (nextId += 1);
    setToasts((all) => [...all, { id, message, tone }]);
    setTimeout(() => {
      setToasts((all) => all.filter((t) => t.id !== id));
    }, tone === "error" ? 6000 : 3500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: (message) => push(message, "info"),
      error: (message) => push(message, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        data-print="hide"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`rise pointer-events-auto max-w-sm rounded-sm bg-ink px-4 py-3 text-sm text-white shadow-lg ${
              t.tone === "error" ? "border-l-2 border-l-accent" : ""
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
