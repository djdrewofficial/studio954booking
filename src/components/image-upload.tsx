"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { Button, cx } from "./ui";

/**
 * Picks a photo, uploads it, and keeps the resulting URL in a hidden input so
 * the surrounding plain-HTML form submits it like any other field.
 *
 * A URL can still be typed by hand, which matters for photos already hosted
 * somewhere else.
 */
export function ImageUpload({
  name,
  defaultValue,
  label = "Photo",
  disabled,
}: {
  name: string;
  defaultValue?: string | null;
  label?: string;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", "photo");

      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? "That upload did not work.");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("That upload did not work. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="label text-ink">{label}</span>

      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cx(
            "relative size-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-sand",
            busy ? "opacity-50" : null,
          )}
        >
          {url ? (
            <Image src={url} alt="" fill className="object-cover" sizes="96px" unoptimized />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[0.8125rem] text-muted">
              No photo
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : url ? "Replace photo" : "Upload a photo"}
            </Button>
            {url ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || busy}
                onClick={() => setUrl("")}
              >
                Remove
              </Button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="self-start text-[0.9375rem] text-muted underline underline-offset-2 hover:text-ink"
          >
            {showManual ? "Hide link field" : "Or paste a link"}
          </button>
        </div>
      </div>

      {showManual ? (
        <input
          type="url"
          value={url}
          disabled={disabled}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="h-12 w-full rounded-xl border border-line-strong bg-surface px-4 focus:border-accent focus:outline-none"
        />
      ) : null}

      {error ? <p className="text-[0.9375rem] font-medium text-danger">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {/* The value the surrounding form actually submits. */}
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
