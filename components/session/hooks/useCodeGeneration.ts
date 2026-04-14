import { useState, useCallback } from "react";
import type { IacFiles } from "../CodePanel";

export function useCodeGeneration(
  sessionId: string,
  initial: { iacCode: IacFiles | null; iacStale: boolean },
) {
  const [iacCode, setIacCode] = useState<IacFiles | null>(initial.iacCode);
  const [iacStale, setIacStale] = useState(initial.iacStale);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagram" | "code" | "deploy">("diagram");

  const generateCode = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
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
  }, [sessionId]);

  const markStale = useCallback(() => {
    if (iacCode) setIacStale(true);
  }, [iacCode]);

  return { iacCode, iacStale, isGenerating, activeTab, setActiveTab, generateCode, markStale };
}
