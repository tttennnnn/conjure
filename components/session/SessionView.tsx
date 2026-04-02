"use client";

import { useState, useCallback } from "react";
import ChatPanel from "./ChatPanel";
import ChatInput from "./ChatInput";
import DiagramPanel from "./DiagramPanel";
import CodePanel, { type IacFiles } from "./CodePanel";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SessionData {
  id: string;
  name: string;
  targetEnv: string;
  iacTool: string;
  model: string;
  mermaidCode: string;
  configYaml: string;
  status: string;
  iacCode: IacFiles | null;
  iacStale: boolean;
}

interface SessionViewProps {
  session: SessionData;
  initialMessages: ChatMessage[];
}

export default function SessionView({ session, initialMessages }: SessionViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [mermaidCode, setMermaidCode] = useState(session.mermaidCode);
  const [, setConfigYaml] = useState(session.configYaml);
  const [isLoading, setIsLoading] = useState(false);
  const [iacCode, setIacCode] = useState<IacFiles | null>(session.iacCode);
  const [iacStale, setIacStale] = useState(session.iacStale);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagram" | "code">("diagram");

  const handleSendMessage = useCallback(
    async (content: string) => {
      const tempId = `temp-${Date.now()}`;
      const userMsg: ChatMessage = {
        id: tempId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, message: content }),
        });

        if (!res.ok) {
          const data = await res.json();
          const errorMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: data.error || "Something went wrong. Please try again.",
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        const data = await res.json();

        // Replace temp user message with server-persisted one
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          data.userMessage,
          data.assistantMessage,
        ]);

        if (data.mermaidCode) setMermaidCode(data.mermaidCode);
        if (data.configYaml) setConfigYaml(data.configYaml);
        // Mark code stale when diagram or config changes and code already exists
        if ((data.mermaidCode || data.configYaml) && iacCode) {
          setIacStale(true);
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Failed to send message. Please try again.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [session.id, iacCode],
  );

  const handleGenerateCode = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Code generation failed:", data.error);
        return;
      }
      const files: IacFiles = await res.json();
      setIacCode(files);
      setIacStale(false);
      setActiveTab("code");
    } catch (err) {
      console.error("Code generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [session.id]);

  const handleEditSave = useCallback(
    (newMermaidCode: string) => {
      setMermaidCode(newMermaidCode);
      if (iacCode) setIacStale(true);
    },
    [iacCode],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3.5">
        <span className="text-xs font-semibold">{session.name}</span>
        <div className="flex gap-1.5">
          <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
            {session.targetEnv.toUpperCase()}
          </span>
          <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
            {session.model}
          </span>
          <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]">
            {session.iacTool}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
          <ChatPanel messages={messages} isLoading={isLoading} />
          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>

        {/* Diagram / Code column */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Tab switcher — Code tab only appears after first generation */}
          {iacCode && (
            <div className="flex h-[38px] shrink-0 items-end border-b border-[var(--border)] bg-[var(--surface)] px-2.5">
              {(["diagram", "code"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "flex h-[30px] items-center rounded-t-md border border-b-0 px-3 text-[10px] font-medium capitalize transition-colors",
                    activeTab === tab
                      ? "border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {activeTab === "diagram" || !iacCode ? (
            <DiagramPanel
              mermaidCode={mermaidCode}
              isStale={iacStale}
              hasCode={!!iacCode}
              hasOuterTabs={!!iacCode}
              isGenerating={isGenerating}
              onGenerateCode={handleGenerateCode}
              onEditSave={handleEditSave}
            />
          ) : (
            <CodePanel
              iacCode={iacCode}
              isStale={iacStale}
              iacTool={session.iacTool}
            />
          )}
        </div>
      </div>
    </div>
  );
}
