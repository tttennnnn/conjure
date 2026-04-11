import { describe, it, expect } from "vitest";
import { classifyLLMError, LLM_ERROR_RESPONSE, LLM_AUTH_ERROR_RESPONSE } from "@/lib/api/errors";

describe("classifyLLMError", () => {
  it("returns auth error for status 401", () => {
    const result = classifyLLMError({ status: 401 });
    expect(result.status).toBe(401);
    expect(result.message).toBe(LLM_AUTH_ERROR_RESPONSE);
  });

  it("returns invalid request for status 400", () => {
    const result = classifyLLMError({ status: 400 });
    expect(result.status).toBe(400);
    expect(result.message).toMatch(/invalid/i);
  });

  it("returns rate limit for status 429", () => {
    const result = classifyLLMError({ status: 429 });
    expect(result.status).toBe(429);
    expect(result.message).toMatch(/rate limit/i);
  });

  it("returns unavailable for status 502", () => {
    const result = classifyLLMError({ status: 502 });
    expect(result.status).toBe(503);
    expect(result.message).toMatch(/unavailable/i);
  });

  it("returns unavailable for status 503", () => {
    const result = classifyLLMError({ status: 503 });
    expect(result.status).toBe(503);
  });

  it("returns generic error for unknown status", () => {
    const result = classifyLLMError({ status: 418 });
    expect(result.status).toBe(500);
    expect(result.message).toBe(LLM_ERROR_RESPONSE);
  });

  it("returns generic error for non-object", () => {
    const result = classifyLLMError("string error");
    expect(result.status).toBe(500);
    expect(result.message).toBe(LLM_ERROR_RESPONSE);
  });

  it("returns generic error for null", () => {
    const result = classifyLLMError(null);
    expect(result.status).toBe(500);
  });
});
