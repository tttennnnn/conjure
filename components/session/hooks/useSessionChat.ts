import { useState, useCallback } from "react";
import type { ChatMessage, ChatEvent } from "../SessionView";

export function useSessionChat(
  sessionId: string,
  initialMessages: (ChatMessage | ChatEvent)[],
  onDiagramChanged: () => void,
) {
  const [messages, setMessages] = useState<(ChatMessage | ChatEvent)[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
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
          body: JSON.stringify({ sessionId, message: content }),
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

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          data.userMessage,
          data.assistantMessage,
        ]);

        if (data.mermaidCode || data.configYaml) {
          onDiagramChanged();
        }

        return data as {
          mermaidCode: string | null;
          configYaml: string | null;
        };
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
    [sessionId, onDiagramChanged],
  );

  return { messages, isLoading, sendMessage, setMessages };
}
