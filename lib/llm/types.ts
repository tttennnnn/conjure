export interface ParsedBlocks {
  chatText: string;
  mermaidCode: string | null;
  configYaml: string | null;
}

export interface LLMResponse {
  chatText: string;
  mermaid: string | null;
  configYaml: string | null;
  validationWarnings: string[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}
