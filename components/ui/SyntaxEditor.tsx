"use client";

import { useEffect } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";

// Minimal Mermaid grammar — keywords, node labels, arrows, strings, comments
function registerMermaidGrammar() {
  if (Prism.languages.mermaid) return;
  Prism.languages.mermaid = {
    comment: /%%[^\n]*/,
    keyword: /\b(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|subgraph|end|loop|alt|opt|par|else|rect|activate|deactivate|note|over|left|right|of|title|section|TD|LR|RL|BT|TB)\b/,
    "node-label": /[\[({"'][^\])"'}]*[\])"'}]/,
    arrow: /(?:-{1,2}>|={1,2}>|\.{1,2}>|-{1,2}o|o-{1,2}|x-{1,2}|-{1,2}x|<-{1,2}>|<={1,2}>|-{2,})/,
    string: /"[^"]*"/,
    number: /\b\d+(?:\.\d+)?\b/,
    punctuation: /[{}[\];(),.:]/,
  };
}

type Language = "yaml" | "mermaid";

interface SyntaxEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  language: Language;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function SyntaxEditor({
  value,
  onChange,
  onKeyDown,
  language,
  className = "",
  style,
  disabled = false,
}: SyntaxEditorProps) {
  useEffect(() => {
    if (language === "mermaid") registerMermaidGrammar();
  }, [language]);

  function highlight(code: string): string {
    const grammar = language === "mermaid" ? Prism.languages.mermaid : Prism.languages.yaml;
    if (!grammar) return code;
    return Prism.highlight(code, grammar, language);
  }

  return (
    <Editor
      value={value}
      onValueChange={disabled ? () => {} : onChange}
      highlight={highlight}
      onKeyDown={onKeyDown}
      padding={8}
      readOnly={disabled}
      textareaClassName="focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded"
      className={[
        "min-h-full rounded border border-[var(--border)] bg-[var(--bg)] font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--text)]",
        disabled ? "opacity-60 cursor-default" : "",
        className,
      ].join(" ")}
      style={{ ...style }}
    />
  );
}
