"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Kopiuj" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-lg border border-line px-3 py-1 text-xs text-muted hover:border-gold hover:text-white"
    >
      {copied ? "Skopiowano ✓" : label}
    </button>
  );
}
