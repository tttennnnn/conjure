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

export function getAvailableModels(
  hasOpenRouterKey: boolean,
  hasAnthropicKey: boolean,
): ModelOption[] {
  return MODELS.filter((m) => {
    if (m.provider === "anthropic") return hasAnthropicKey;
    // Free OpenRouter models are always available; premium ones need a key
    if (m.tier === "free") return true;
    return hasOpenRouterKey;
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

/** Returns true if the model ID is not in the built-in list (i.e. a custom OpenRouter model). */
export function isCustomOpenRouterModel(id: string): boolean {
  return !MODELS.some((m) => m.id === id);
}

/**
 * Resolve the actual API model ID for a given session model string.
 * For built-in models, returns the provider-specific ID (openRouterId or anthropicId).
 * For custom models, the session model string IS the OpenRouter model ID.
 */
export function resolveModelId(sessionModel: string): {
  modelId: string;
  provider: "openrouter" | "anthropic";
  disableReasoning: boolean;
} | null {
  const builtIn = getModelById(sessionModel);
  if (builtIn) {
    const modelId = builtIn.provider === "anthropic"
      ? builtIn.anthropicId
      : builtIn.openRouterId;
    if (!modelId) return null;
    return { modelId, provider: builtIn.provider, disableReasoning: builtIn.disableReasoning ?? false };
  }
  // Custom model -- always OpenRouter
  return { modelId: sessionModel, provider: "openrouter", disableReasoning: false };
}
