"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const MAX_MESSAGE_LENGTH = 1000;
const WARNING_THRESHOLD = 0.8;

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || trimmed.length > MAX_MESSAGE_LENGTH) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const charCount = value.length;
  const overWarning = charCount > MAX_MESSAGE_LENGTH * WARNING_THRESHOLD;
  const overLimit = charCount > MAX_MESSAGE_LENGTH;

  return (
    <div className="border-t border-[var(--border)] px-2.5 py-2">
      <div className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Describe your infrastructure..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-[7px] border border-[var(--border2)] bg-[var(--surface2)] px-2.5 py-[7px] text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--hint)] focus:border-[var(--text)] focus:bg-[var(--surface)] disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || overLimit}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-none bg-[var(--text)] text-white disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      {overWarning && (
        <div className={`mt-1 text-right text-[9px] ${overLimit ? "text-[var(--danger-text)]" : "text-[var(--muted)]"}`}>
          {charCount}/{MAX_MESSAGE_LENGTH}
        </div>
      )}
    </div>
  );
}
