import type { ParsedBlocks, LLMResponse } from "./types";
import { validateMermaid } from "@/lib/mermaid/validate";
import { validateConfigYaml } from "@/lib/config/validate";
import { checkNodeIdSync } from "@/lib/config/sync";
import { extractMermaidNodeIds } from "@/lib/mermaid/validate";
import { extractConfigNodeIds } from "@/lib/config/validate";

// Strip <think>/<thinking> blocks emitted by reasoning models (Qwen3, DeepSeek-R1, QwQ, etc).
// Applied before extractBlocks so thinking text never surfaces as chatText.
export function stripThinkingBlocks(raw: string): string {
  return raw.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "").trim();
}

// ── Delimiter patterns ──

const MERMAID_PRIMARY = /<<<MERMAID>>>\s*\n?([\s\S]*?)\n?\s*<<<END_MERMAID>>>/;
const CONFIG_PRIMARY = /<<<CONFIG>>>\s*\n?([\s\S]*?)\n?\s*<<<END_CONFIG>>>/;

const MERMAID_FUZZY = /<?<<?MERMAID>?>?>?\s*\n?([\s\S]*?)\n?\s*<?<<?END_MERMAID>?>?>?/i;
const CONFIG_FUZZY = /<?<<?CONFIG>?>?>?\s*\n?([\s\S]*?)\n?\s*<?<<?END_CONFIG>?>?>?/i;

const MERMAID_FENCE = /```mermaid\s*\n([\s\S]*?)\n\s*```/;

const MERMAID_RAW = /^((?:graph|flowchart)\s+(?:TD|TB|BT|RL|LR)\b[\s\S]*?)(?=\n\n|\n(?:nodes:)|$)/m;

function unwrapOuterFence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    const inner = trimmed.slice(trimmed.indexOf("\n") + 1, trimmed.lastIndexOf("```"));
    if (inner.trim().length > 0) return inner;
  }
  return raw;
}

function tryExtract(
  raw: string,
  primary: RegExp,
  fuzzy: RegExp,
): { content: string; fullMatch: string } | null {
  let m = primary.exec(raw);
  if (m?.[1]) return { content: m[1].trim(), fullMatch: m[0] };

  m = fuzzy.exec(raw);
  if (m?.[1]) return { content: m[1].trim(), fullMatch: m[0] };

  return null;
}

export function extractBlocks(rawResponse: string): ParsedBlocks {
  const raw = unwrapOuterFence(rawResponse);
  let mermaidCode: string | null = null;
  let configYaml: string | null = null;
  const removals: string[] = [];

  // Try primary + fuzzy delimiters for Mermaid
  const mermaidBlock = tryExtract(raw, MERMAID_PRIMARY, MERMAID_FUZZY);
  if (mermaidBlock) {
    mermaidCode = mermaidBlock.content;
    removals.push(mermaidBlock.fullMatch);
  }

  // Try primary + fuzzy delimiters for Config
  const configBlock = tryExtract(raw, CONFIG_PRIMARY, CONFIG_FUZZY);
  if (configBlock) {
    configYaml = configBlock.content;
    removals.push(configBlock.fullMatch);
  }

  // Fallback: fenced code blocks
  if (!mermaidCode) {
    const mFence = MERMAID_FENCE.exec(raw);
    if (mFence?.[1]) {
      mermaidCode = mFence[1].trim();
      removals.push(mFence[0]);
    }
  }

  if (!configYaml) {
    // Pick the YAML fence containing 'nodes:' if multiple exist
    const allYamlFences: { content: string; fullMatch: string }[] = [];
    const fenceRegex = /```(?:yaml|yml)\s*\n([\s\S]*?)\n\s*```/g;
    let yMatch: RegExpExecArray | null;
    while ((yMatch = fenceRegex.exec(raw)) !== null) {
      allYamlFences.push({ content: yMatch[1]!.trim(), fullMatch: yMatch[0] });
    }
    const nodesYaml = allYamlFences.find((f) => f.content.includes("nodes:"));
    const picked = nodesYaml || allYamlFences[0];
    if (picked) {
      configYaml = picked.content;
      removals.push(picked.fullMatch);
    }
  }

  // Fallback: raw pattern detection for Mermaid
  if (!mermaidCode) {
    const rawM = MERMAID_RAW.exec(raw);
    if (rawM?.[1]) {
      mermaidCode = rawM[1].trim();
      removals.push(rawM[0]);
    }
  }

  // Compute chat text by removing all extracted blocks
  let chatText = raw;
  for (const removal of removals) {
    chatText = chatText.replace(removal, "");
  }
  chatText = chatText.trim();

  // If chat text is empty but we got blocks, provide a default
  if (!chatText && (mermaidCode || configYaml)) {
    chatText = "I've updated the infrastructure diagram.";
  }

  return { chatText, mermaidCode, configYaml };
}

export function parseLLMResponse(
  blocks: ParsedBlocks,
  currentMermaid: string,
  currentConfig: string,
): LLMResponse {
  const warnings: string[] = [];

  let mermaid: string | null = null;
  let configYaml: string | null = null;

  const hasMermaid = blocks.mermaidCode !== null && blocks.mermaidCode.length > 0;
  const hasConfig = blocks.configYaml !== null && blocks.configYaml.length > 0;

  if (!hasMermaid && !hasConfig) {
    // Pure question response
    return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: [] };
  }

  // Validate Mermaid if present
  let mermaidValid = false;
  let mermaidNodeIds: string[] = [];
  if (hasMermaid) {
    const mResult = validateMermaid(blocks.mermaidCode!);
    mermaidValid = mResult.valid;
    mermaidNodeIds = mResult.nodeIds;
    if (!mermaidValid) {
      warnings.push(`Diagram errors: ${mResult.errors.join(", ")}`);
    }
  }

  // Validate Config if present
  let configValid = false;
  let configNodeIds: string[] = [];
  if (hasConfig) {
    // Pre-process: replace tabs with spaces for YAML tolerance
    const cleanedYaml = blocks.configYaml!.replace(/\t/g, "  ");
    const cResult = validateConfigYaml(cleanedYaml);
    configValid = cResult.valid;
    configNodeIds = cResult.nodeIds;
    if (configValid) {
      blocks.configYaml = cleanedYaml;
    } else {
      warnings.push(`Config errors: ${cResult.errors.join(", ")}`);
    }
  }

  // Both present -- check sync
  if (hasMermaid && hasConfig) {
    if (!mermaidValid || !configValid) {
      warnings.push("Diagram update discarded due to validation errors.");
      return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: warnings };
    }
    const sync = checkNodeIdSync(mermaidNodeIds, configNodeIds);
    if (!sync.inSync) {
      warnings.push(
        `Node ID mismatch. Update discarded.`,
      );
      return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: warnings };
    }
    mermaid = blocks.mermaidCode;
    configYaml = blocks.configYaml;
  }

  // Config only -- validate against existing Mermaid
  if (!hasMermaid && hasConfig) {
    if (!configValid) {
      return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: warnings };
    }
    const existingMermaidIds = currentMermaid ? extractMermaidNodeIds(currentMermaid) : [];
    const sync = checkNodeIdSync(existingMermaidIds, configNodeIds);
    if (!sync.inSync) {
      warnings.push("Config update changed node IDs without updating the diagram. Update discarded.");
      return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: warnings };
    }
    configYaml = blocks.configYaml;
  }

  // Mermaid only -- topology change should produce both, but allow if IDs match existing config
  if (hasMermaid && !hasConfig) {
    if (!mermaidValid) {
      return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: warnings };
    }
    const existingConfigIds = currentConfig ? extractConfigNodeIds(currentConfig) : [];
    const sync = checkNodeIdSync(mermaidNodeIds, existingConfigIds);
    if (!sync.inSync) {
      warnings.push("Diagram changed topology without updating config. Update discarded.");
      return { chatText: blocks.chatText, mermaid: null, configYaml: null, validationWarnings: warnings };
    }
    mermaid = blocks.mermaidCode;
  }

  return { chatText: blocks.chatText, mermaid, configYaml, validationWarnings: warnings };
}
