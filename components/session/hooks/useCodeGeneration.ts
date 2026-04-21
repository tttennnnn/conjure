import { useState, useCallback } from "react";
import type { IacFiles } from "../CodePanel";

export function useCodeGeneration(
  sessionId: string,
  initial: { iacCode: IacFiles | null; iacStale: boolean },
  onCodeRegenerated?: () => void,
) {
  const [iacCode, setIacCode] = useState<IacFiles | null>(initial.iacCode);
  const [iacStale, setIacStale] = useState(initial.iacStale);
  const [isGenerating, setIsGenerating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"diagram" | "code" | "deploy">("diagram");

  const generateCode = useCallback(async () => {
    setIsGenerating(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/generate/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        setCodeError("Code generation failed — please try again.");
        return;
      }
      const files: IacFiles = await res.json();
      setCodeError(null);
      setIacCode(files);
      setIacStale(false);
      setActiveTab("code");
      onCodeRegenerated?.();
    } catch {
      setCodeError("Code generation failed — please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, onCodeRegenerated]);

  const markStale = useCallback(() => {
    if (iacCode) setIacStale(true);
  }, [iacCode]);

  return { iacCode, iacStale, isGenerating, codeError, activeTab, setActiveTab, generateCode, markStale };
}
