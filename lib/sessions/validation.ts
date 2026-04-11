export const TARGET_ENVS = ["aws", "gcp"] as const;
export type TargetEnv = (typeof TARGET_ENVS)[number];

export const IAC_TOOLS = ["terraform"] as const;
export type IacTool = (typeof IAC_TOOLS)[number];

export interface ModelOption {
  id: string;
  name: string;
  provider: "openrouter" | "anthropic";
  tier: "free" | "premium";
  openRouterId?: string;
  anthropicId?: string;
  // True for models where reasoning must be disabled via OpenRouter extension
  // (e.g. Nemotron, which emits inline CoT that bleeds into structured output).
  // False/absent for models where reasoning is mandatory or not applicable.
  disableReasoning?: boolean;
}

const MODELS: ModelOption[] = [
  {
    id: "nemotron-super-120b",
    name: "Nemotron Super 120B",
    provider: "openrouter",
    tier: "free",
    openRouterId: "nvidia/nemotron-3-super-120b-a12b:free",
    disableReasoning: true,
  },
  {
    id: "gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openrouter",
    tier: "free",
    openRouterId: "openai/gpt-oss-120b:free",
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "premium",
    anthropicId: "claude-haiku-4-5-20251001",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    tier: "premium",
    anthropicId: "claude-sonnet-4-6-20250725",
  },
  {
    id: "claude-opus",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    tier: "premium",
    anthropicId: "claude-opus-4-6-20250501",
  },
];

// Keys that require BYOK — free-tier OpenRouter models are always available without a key.
// To add a new BYOK provider, add it here: premium models for that provider will unlock
// when the user's key is present.
const BYOK_PROVIDERS = new Set<string>(["anthropic"]);

export function getAvailableModels(userKeys: Partial<Record<string, boolean>>): ModelOption[] {
  return MODELS.filter((m) => {
    // Models from BYOK-only providers require the user's key
    if (BYOK_PROVIDERS.has(m.provider)) return !!userKeys[m.provider];
    // Free-tier OpenRouter models are always available
    if (m.tier === "free") return true;
    // Premium non-BYOK models would require their own flag here
    return !!userKeys[m.provider];
  });
}

export function getModelById(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isValidTargetEnv(v: string): v is TargetEnv {
  return TARGET_ENVS.includes(v as TargetEnv);
}

export function isValidIacTool(v: string): v is IacTool {
  return IAC_TOOLS.includes(v as IacTool);
}

export function isValidModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}

const MAX_SESSION_NAME_LENGTH = 100;

export function sanitizeSessionName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SESSION_NAME_LENGTH) return null;
  return trimmed;
}

const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function isValidGithubRepo(repo: string): boolean {
  return repo.length <= 200 && GITHUB_REPO_PATTERN.test(repo);
}

/**
 * Validates a git branch name using git check-ref-format rules.
 * See: https://git-scm.com/docs/git-check-ref-format
 */
export function isValidGithubBranch(branch: string): boolean {
  if (!branch || branch.length > 255) return false;
  // Forbid control characters and special git symbols
  if (/[\x00-\x1f\x7f ~^:?*\[\\\s]/.test(branch)) return false;
  if (branch.includes("..")) return false;   // no consecutive dots
  if (branch.includes("@{")) return false;   // no @{ sequence
  if (branch.startsWith("/") || branch.endsWith("/")) return false;
  if (branch.startsWith(".") || branch.endsWith(".")) return false;
  if (branch.endsWith(".lock")) return false;
  if (branch === "@") return false;
  if (branch.includes("//")) return false;   // no consecutive slashes
  return true;
}

/**
 * Resolve the actual API model ID for a given session model string.
 * Returns null if the model ID is not in the built-in list.
 */
export function resolveModelId(sessionModel: string): {
  modelId: string;
  provider: "openrouter" | "anthropic";
  disableReasoning: boolean;
} | null {
  const builtIn = getModelById(sessionModel);
  if (!builtIn) return null;
  const modelId = builtIn.provider === "anthropic"
    ? builtIn.anthropicId
    : builtIn.openRouterId;
  if (!modelId) return null;
  return { modelId, provider: builtIn.provider, disableReasoning: builtIn.disableReasoning ?? false };
}
