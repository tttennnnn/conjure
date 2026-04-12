// ---------- Roles ----------
export type MessageRole = "user" | "assistant" | "event";

// ---------- Event kinds (manual edits only — AI updates use diagramUpdated on the assistant message) ----------
export type EventKind =
  | "diagram-updated-manual"
  | "config-updated-manual";

/** Human-readable labels for event rows displayed in the chat timeline */
export const EVENT_LABELS: Record<EventKind, string> = {
  "diagram-updated-manual": "diagram updated (manual edit)",
  "config-updated-manual": "config updated (manual edit)",
};

// ---------- Shared message shape ----------
export interface ChatMessageData {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  eventKind?: EventKind;
  diagramUpdated?: boolean; // legacy fallback only
}
