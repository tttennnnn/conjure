"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ChatPanel from "./ChatPanel";
import ChatInput from "./ChatInput";
import DiagramPanel from "./DiagramPanel";
import CodePanel, { type IacFiles } from "./CodePanel";
import PropertiesDrawer from "./PropertiesDrawer";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  diagramUpdated?: boolean;
}

export interface ChatEvent {
  id: string;
  kind: "config-edit";
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
  const [sessionName, setSessionName] = useState(session.name);
  const [messages, setMessages] = useState<(ChatMessage | ChatEvent)[]>(initialMessages);
  const [mermaidCode, setMermaidCode] = useState(session.mermaidCode);
  const [configYaml, setConfigYaml] = useState(session.configYaml);
  const [isLoading, setIsLoading] = useState(false);
  const [iacCode, setIacCode] = useState<IacFiles | null>(session.iacCode);
  const [iacStale, setIacStale] = useState(session.iacStale);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagram" | "code">("diagram");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(sessionName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onRenamed(e: CustomEvent<{ id: string; name: string }>) {
      if (e.detail.id === session.id) setSessionName(e.detail.name);
    }
    window.addEventListener("session-renamed", onRenamed as EventListener);
    return () => window.removeEventListener("session-renamed", onRenamed as EventListener);
  }, [session.id]);

  const startRenaming = useCallback(() => {
    setRenameDraft(sessionName);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, [sessionName]);

  const commitRename = useCallback(async () => {
    setIsRenaming(false);
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === sessionName) return;

    try {
      await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setSessionName(trimmed);
      window.dispatchEvent(
        new CustomEvent("session-renamed", { detail: { id: session.id, name: trimmed } }),
      );
    } catch {
      // name stays unchanged in both topbar and sidebar
    }
  }, [renameDraft, sessionName, session.id]);

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
    async (newMermaidCode: string) => {
      setMermaidCode(newMermaidCode);
      if (iacCode) setIacStale(true);

      try {
        const res = await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mermaidCode: newMermaidCode }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.editMessage) {
            setMessages((prev) => [...prev, data.editMessage]);
          }
          if (data.iacStale) setIacStale(true);
        }
      } catch {
        // Local state already updated; server sync failed silently
      }
    },
    [session.id, iacCode],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3.5">
        <div className="flex items-center gap-1.5">
          {isRenaming ? (
            <>
              <input
                ref={renameInputRef}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                className="h-6 w-48 rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 text-xs font-semibold outline-none focus:border-[var(--text)]"
                maxLength={100}
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitRename}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                title="Save"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 8 6 12 14 4" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold">{sessionName}</span>
              <button
                onClick={startRenaming}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                title="Rename session"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                </svg>
              </button>
            </>
          )}
        </div>
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

          <div className="flex flex-1 min-h-0">
            {activeTab === "diagram" || !iacCode ? (
              <DiagramPanel
                mermaidCode={mermaidCode}
                isStale={iacStale}
                hasCode={!!iacCode}
                hasOuterTabs={!!iacCode}
                isGenerating={isGenerating}
                onGenerateCode={handleGenerateCode}
                onEditSave={handleEditSave}
                onNodeClick={setSelectedNodeId}
              />
            ) : (
              <CodePanel
                iacCode={iacCode}
                isStale={iacStale}
                iacTool={session.iacTool}
              />
            )}

            {selectedNodeId && (
              <PropertiesDrawer
                nodeId={selectedNodeId}
                configYaml={configYaml}
                sessionId={session.id}
                onClose={() => setSelectedNodeId(null)}
                onSaved={(newYaml, newIacStale) => {
                  setConfigYaml(newYaml);
                  if (newIacStale) setIacStale(true);
                  setMessages((prev) => [
                    ...prev,
                    { id: `props-${Date.now()}`, kind: "config-edit" as const, createdAt: new Date().toISOString() },
                  ]);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
