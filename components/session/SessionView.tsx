"use client";

import { useState, useCallback } from "react";
import ChatPanel from "./ChatPanel";
import ChatInput from "./ChatInput";
import DiagramPanel from "./DiagramPanel";
import CodePanel, { type IacFiles } from "./CodePanel";
import PropertiesDrawer from "./PropertiesDrawer";
import SessionTopbar from "./SessionTopbar";
import { useSessionChat } from "./hooks/useSessionChat";
import { useCodeGeneration } from "./hooks/useCodeGeneration";
import type { ChatMessageData } from "@/lib/chat/types";

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
}

interface SessionViewProps {
  session: SessionData;
  initialMessages: ChatMessage[];
}


export default function SessionView({ session, initialMessages }: SessionViewProps) {
  const [mermaidCode, setMermaidCode] = useState(session.mermaidCode);
  const [configYaml, setConfigYaml] = useState(session.configYaml);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
        <div className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
          {(session.githubRepo || session.githubBranch) && (
            <div className="shrink-0 border-b border-[var(--border)] bg-[var(--info-bg)] px-3 py-2 text-[10px] text-[var(--info-text)]">
              Linked to {session.githubRepo ?? "repo"}
              {session.githubBranch ? ` (${session.githubBranch})` : ""}.{" "}
              Auto-import of existing .tf files is coming soon — you can build from scratch and export to this repo later.
            </div>
          )}
          <ChatPanel messages={chat.messages} isLoading={chat.isLoading} />
          <ChatInput onSend={handleSendMessage} disabled={chat.isLoading} />
        </div>

        {/* Diagram / Code column */}
        <div className="flex flex-1 flex-col min-w-0">
          {codegen.iacCode && (
            <div className="flex h-[38px] shrink-0 items-end border-b border-[var(--border)] bg-[var(--surface)] px-2.5">
              {(["diagram", "code"] as const).map((tab) => (
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
                onGenerateCode={codegen.generateCode}
                onEditSave={handleEditSave}
                onNodeClick={setSelectedNodeId}
              />
            ) : (
              <CodePanel
                iacCode={codegen.iacCode}
                isStale={codegen.iacStale}
                iacTool={session.iacTool}
              />
            )}

            {selectedNodeId && (
              <PropertiesDrawer
                nodeId={selectedNodeId}
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
