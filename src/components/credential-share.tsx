"use client";
import { useState } from "react";
export function CredentialShare({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  return (
    <div className="credential-share">
      <button
        type="button"
        className="button"
        onClick={async () => {
          const url = new URL(
            `/credentials/${encodeURIComponent(id)}`,
            window.location.origin,
          ).href;
          try {
            await navigator.clipboard.writeText(url);
            setFallbackUrl("");
            setMessage("Credential link copied.");
          } catch {
            setFallbackUrl(url);
            setMessage("Copy the link below. Clipboard access is unavailable.");
          }
        }}
      >
        Copy Credential Link
      </button>
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {fallbackUrl && (
        <label className="field">
          Public credential link
          <input
            readOnly
            value={fallbackUrl}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </div>
  );
}
