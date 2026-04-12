"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./SessionView";
import { EVENT_LABELS, type EventKind } from "@/lib/chat/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ChatPanel({ messages, isLoading }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-[11px] leading-relaxed text-[var(--hint)]">
            Describe your infrastructure
            <br />
            to get started.
          </p>
        </div>
      )}

      {messages.map((item) => {
        // Manual edit event rows → divider
        if (item.eventKind) {
          const label = EVENT_LABELS[item.eventKind as EventKind] ?? item.eventKind;
          return (
            <div key={item.id} className="flex items-center gap-2 py-0.5">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-[10px] text-[var(--hint)]">{label}</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
          );
        }

        // Legacy manual-edit user messages (old: role=user + diagramUpdated) → divider
        if (item.role === "user" && item.diagramUpdated) {
          return (
            <div key={item.id} className="flex items-center gap-2 py-0.5">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-[10px] text-[var(--hint)]">diagram updated (manual edit)</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className={`flex flex-col gap-1 ${
              item.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[220px] px-2.5 py-[7px] text-[11px] leading-relaxed whitespace-pre-wrap ${
                item.role === "user"
                  ? "rounded-[10px_10px_2px_10px] bg-[var(--text)] text-white"
                  : "rounded-[10px_10px_10px_2px] bg-[var(--surface2)] text-[var(--text)]"
              }`}
            >
              {item.content}
            </div>
            {item.role === "assistant" && item.diagramUpdated && (
              <div className="inline-flex items-center gap-1 rounded-[5px] bg-[var(--purple-bg)] px-2 py-[3px] text-[10px] font-medium text-[var(--purple-text)]">
                ↗ diagram/config updated
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex gap-1 rounded-[10px_10px_10px_2px] bg-[var(--surface2)] px-3 py-2.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hint)] [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hint)] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hint)] [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
