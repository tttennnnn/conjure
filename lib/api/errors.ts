export const LLM_ERROR_RESPONSE = "Sorry, I encountered an error processing your request. Please try again.";
export const LLM_AUTH_ERROR_RESPONSE = "Your API key is invalid or has been revoked. Please update it in Settings > API Keys.";

function getErrorStatus(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "status" in err) {
    return (err as { status: number }).status;
  }
  return null;
}

/** Classify an LLM SDK error into a user-facing message and HTTP status. */
export function classifyLLMError(err: unknown): { message: string; status: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return { message: LLM_AUTH_ERROR_RESPONSE, status: 200 };
  }
  if (status === 429) {
    return { message: "The model is currently rate limited. Please wait a moment and try again.", status: 200 };
  }
  if (status === 502 || status === 503) {
    return { message: "The model is temporarily unavailable. Please try again shortly.", status: 200 };
  }

  return { message: LLM_ERROR_RESPONSE, status: 200 };
}
