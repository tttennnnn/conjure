import { useState, useCallback } from "react";
import type { ChatMessage } from "../SessionView";

export function useSessionChat(
  sessionId: string,
  initialMessages: ChatMessage[],
  onDiagramChanged: () => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
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
          let errorContent: string;
          if (res.status === 429) {
            errorContent = "Rate limit reached — wait a moment and try again.";
          } else if (res.status >= 500) {
            errorContent = "Server error — please try again in a moment.";
          } else {
            const data = await res.json().catch(() => ({}));
            errorContent = (data as { error?: string }).error || "Something went wrong. Please try again.";
          }
          const errorMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: errorContent,
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
          content: "Network error — check your connection and try again.",
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
