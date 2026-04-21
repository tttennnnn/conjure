"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ChatPanel from "./ChatPanel";
import ChatInput from "./ChatInput";
import DiagramPanel from "./DiagramPanel";
import CodePanel, { type IacFiles } from "./CodePanel";
import DeployPanel from "./DeployPanel";
import PropertiesDrawer from "./PropertiesDrawer";
import SessionTopbar from "./SessionTopbar";
import { useSessionChat } from "./hooks/useSessionChat";
import { useCodeGeneration } from "./hooks/useCodeGeneration";
import type { ChatMessageData } from "@/lib/chat/types";

const CHAT_DEFAULT_WIDTH = 280;
const CHAT_MIN_WIDTH = 180;
const CHAT_MAX_WIDTH = 560;

type ImportStatus = "idle" | "importing" | "done" | "error";

export type ChatMessage = ChatMessageData;

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
  githubRepo: string | null;
  githubBranch: string | null;
  lastPlanStatus: string | null;
  lastPlanOutput: string | null;
  lastApplyStatus: string | null;
  lastApplyOutput: string | null;
  stateBackend: Record<string, unknown> | null;
  deployJobId: string | null;
  applyJobId: string | null;
  destroyJobId: string | null;
  lastDestroyStatus: string | null;
  lastDestroyOutput: string | null;
  planCredentialProfileId: string | null;
  planRegion: string | null;
}

interface SessionViewProps {
  session: SessionData;
  initialMessages: ChatMessage[];
}

export default function SessionView({ session, initialMessages }: SessionViewProps) {
  const [mermaidCode, setMermaidCode] = useState(session.mermaidCode);
  const [configYaml, setConfigYaml] = useState(session.configYaml);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const [isChatDragging, setIsChatDragging] = useState(false);
  const chatDragging = useRef(false);
  const chatDragListeners = useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (chatDragListeners.current) {
        document.removeEventListener("mousemove", chatDragListeners.current.onMove);
        document.removeEventListener("mouseup", chatDragListeners.current.onUp);
        chatDragListeners.current = null;
      }
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  const startChatDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    chatDragging.current = true;
    setIsChatDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function onMove(ev: MouseEvent) {
      if (!chatDragging.current) return;
      setChatWidth((w) => Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, w + ev.movementX)));
    }
    function onUp() {
      chatDragging.current = false;
      setIsChatDragging(false);
      chatDragListeners.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    chatDragListeners.current = { onMove, onUp };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const codegen = useCodeGeneration(session.id, {
    iacCode: session.iacCode,
    iacStale: session.iacStale,
  });

  const chat = useSessionChat(session.id, initialMessages, codegen.markStale);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const data = await chat.sendMessage(content);
      if (data?.mermaidCode) setMermaidCode(data.mermaidCode);
      if (data?.configYaml) setConfigYaml(data.configYaml);
    },
    [chat],
  );

  const handleEditSave = useCallback(
    async (newMermaidCode: string) => {
      setMermaidCode(newMermaidCode);
      codegen.markStale();

      try {
        const res = await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mermaidCode: newMermaidCode }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.eventMessages?.length) {
            chat.setMessages((prev) => [...prev, ...data.eventMessages]);
          }
          if (data.iacStale) codegen.markStale();
        }
      } catch {
        // Local state already updated; server sync failed silently
      }
    },
    [session.id, codegen, chat],
  );

  const handleImportFromRepo = useCallback(async () => {
    setImportStatus("importing");
    setImportError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json() as { mermaidCode?: string; configYaml?: string; error?: string };
      if (!res.ok) {
        setImportStatus("error");
        setImportError(data.error ?? "Import failed");
      } else {
        if (data.mermaidCode) setMermaidCode(data.mermaidCode);
        if (data.configYaml) setConfigYaml(data.configYaml);
        setImportStatus("done");
      }
    } catch {
      setImportStatus("error");
      setImportError("Network error — could not reach server");
    }
  }, [session.id]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SessionTopbar
        sessionId={session.id}
        initialName={session.name}
        targetEnv={session.targetEnv}
        model={session.model}
        iacTool={session.iacTool}
        githubRepo={session.githubRepo ?? undefined}
      />

      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="relative flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]" style={{ width: chatWidth }}>
          {/* Drag handle — right edge resize */}
          <div
            onMouseDown={startChatDrag}
            className={`absolute inset-y-0 right-0 w-1 cursor-col-resize z-10 ${isChatDragging ? "bg-[var(--accent)]/20" : "hover:bg-[var(--accent)]/20"}`}
          />
          {session.githubRepo && importStatus !== "done" && (
            <div className="shrink-0 border-b border-[var(--border)] bg-[var(--info-bg)] px-3 py-2 text-[10px] text-[var(--info-text)]">
              {importStatus === "error" ? (
                <span className="text-[var(--danger-text)]">
                  Import failed: {importError}{" "}
                  <button
                    onClick={() => { setImportStatus("idle"); setImportError(null); }}
                    className="underline"
                  >
                    Dismiss
                  </button>
                </span>
              ) : !mermaidCode ? (
                <>
                  Linked to {session.githubRepo}
                  {session.githubBranch ? ` (${session.githubBranch})` : ""}.{" "}
                  {session.githubBranch ? (
                    <>
                      <button
                        onClick={handleImportFromRepo}
                        disabled={importStatus === "importing"}
                        className="underline disabled:opacity-60"
                      >
                        {importStatus === "importing" ? "Importing…" : "Import .tf files"}
                      </button>
                      {" "}or start from scratch.
                    </>
                  ) : "Start from scratch in this session."}
                </>
              ) : (
                <>
                  Linked to {session.githubRepo}
                  {session.githubBranch ? ` (${session.githubBranch})` : ""}.
                </>
              )}
            </div>
          )}
          <ChatPanel messages={chat.messages} isLoading={chat.isLoading} />
          <ChatInput onSend={handleSendMessage} disabled={chat.isLoading} />
        </div>

        {/* Diagram / Code column */}
        <div className="flex flex-1 flex-col min-w-0">
          {codegen.iacCode && (
            <div className="flex h-[38px] shrink-0 items-end border-b border-[var(--border)] bg-[var(--surface)] px-2.5">
              {(["diagram", "code", "deploy"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => codegen.setActiveTab(tab)}
                  className={[
                    "flex h-[30px] items-center rounded-t-md border border-b-0 px-3 text-[10px] font-medium capitalize transition-colors",
                    codegen.activeTab === tab
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
            {codegen.activeTab === "diagram" || !codegen.iacCode ? (
              <DiagramPanel
                mermaidCode={mermaidCode}
                isStale={codegen.iacStale}
                hasCode={!!codegen.iacCode}
                hasOuterTabs={!!codegen.iacCode}
                isGenerating={codegen.isGenerating}
                codeError={codegen.codeError}
                onGenerateCode={codegen.generateCode}
                onEditSave={handleEditSave}
                onNodeClick={setSelectedNodeId}
              />
            ) : codegen.activeTab === "code" ? (
              <CodePanel
                iacCode={codegen.iacCode}
                isStale={codegen.iacStale}
                iacTool={session.iacTool}
              />
            ) : (
              <DeployPanel
                sessionId={session.id}
                targetEnv={session.targetEnv}
                iacCode={codegen.iacCode}
                isStale={codegen.iacStale}
                lastPlanStatus={session.lastPlanStatus}
                lastPlanOutput={session.lastPlanOutput}
                lastApplyStatus={session.lastApplyStatus}
                lastApplyOutput={session.lastApplyOutput}
                stateBackend={session.stateBackend}
                deployJobId={session.deployJobId}
                applyJobId={session.applyJobId}
                destroyJobId={session.destroyJobId}
                lastDestroyStatus={session.lastDestroyStatus}
                lastDestroyOutput={session.lastDestroyOutput}
                planCredentialProfileId={session.planCredentialProfileId}
                planRegion={session.planRegion}
                githubRepo={session.githubRepo}
              />
            )}

            {selectedNodeId && (
              <PropertiesDrawer
                nodeId={selectedNodeId}
                mermaidCode={mermaidCode}
                configYaml={configYaml}
                sessionId={session.id}
                onClose={() => setSelectedNodeId(null)}
                onSaved={(newYaml, newIacStale, eventMessage) => {
                  setConfigYaml(newYaml);
                  if (newIacStale) codegen.markStale();
                  if (eventMessage) {
                    chat.setMessages((prev) => [...prev, eventMessage]);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
