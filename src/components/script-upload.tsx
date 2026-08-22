"use client";

import { useRef, useState } from "react";

import { Button, cx } from "./ui";

export type UploadedScript = {
  fileName: string;
  storagePath: string;
  contentType?: string;
  sizeBytes?: number;
};

function readableSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Uploads teleprompter scripts ahead of a session so the copy is already
 * loaded when the client arrives. Files go straight to the private bucket;
 * only their storage path travels with the form.
 */
export function ScriptUpload({
  files,
  onChange,
  disabled,
}: {
  files: UploadedScript[];
  onChange: (files: UploadedScript[]) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(chosen: FileList) {
    setBusy(true);
    setError(null);
    const added: UploadedScript[] = [];

    try {
      for (const file of Array.from(chosen)) {
        const body = new FormData();
        body.set("file", file);
        body.set("kind", "document");

        const response = await fetch("/api/uploads", { method: "POST", body });
        const data = (await response.json()) as {
          path?: string;
          fileName?: string;
          contentType?: string;
          sizeBytes?: number;
          error?: string;
        };

        if (!response.ok || !data.path) {
          setError(data.error ?? "That upload did not work.");
          break;
        }

        added.push({
          fileName: data.fileName ?? file.name,
          storagePath: data.path,
          contentType: data.contentType,
          sizeBytes: data.sizeBytes,
        });
      }

      if (added.length) onChange([...files, ...added]);
    } catch {
      setError("That upload did not work. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {files.length ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.storagePath}
              className="flex items-center justify-between gap-4 rounded-2xl bg-sand px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{file.fileName}</span>
                {file.sizeBytes ? (
                  <span className="text-[0.9375rem] text-muted">{readableSize(file.sizeBytes)}</span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => onChange(files.filter((f) => f.storagePath !== file.storagePath))}
                className="shrink-0 rounded-full px-4 py-2 font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className={cx(busy ? "opacity-70" : null)}
        >
          {busy ? "Uploading…" : files.length ? "Add another script" : "Upload a script"}
        </Button>
        <span className="text-[0.9375rem] text-muted">PDF, Word or plain text · up to 20 MB</span>
      </div>

      {error ? <p className="text-[0.9375rem] font-medium text-danger">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/rtf,application/rtf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
        }}
      />
    </div>
  );
}
