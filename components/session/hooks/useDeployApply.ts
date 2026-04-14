import { useState, useCallback, useRef, useEffect } from "react";
import type { ApplyStatus, ApplyStatusResponse } from "@/app/api/deploy/apply/status/route";

const POLL_INTERVAL_MS = 2500;

export interface DeployApplyState {
  jobId: string | null;
  status: ApplyStatus | null;
  output: string;
  error: string | null;
  isRunning: boolean;
}

export function useDeployApply(
  sessionId: string,
  initial: { lastApplyStatus: string | null; lastApplyOutput: string | null; applyJobId: string | null },
) {
  const initialStatus = (initial.lastApplyStatus as ApplyStatus) ?? null;
  const initialIsRunning = initialStatus === "pending" || initialStatus === "running";

  const [state, setState] = useState<DeployApplyState>({
    jobId: initial.applyJobId ?? null,
    status: initialStatus,
    output: initial.lastApplyOutput ?? "",
    error: null,
    isRunning: initialIsRunning,
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/deploy/apply/status?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: err.error ?? "Failed to fetch apply status",
            isRunning: false,
          }));
          stopPolling();
          return;
        }

        const data: ApplyStatusResponse = await res.json();
        setState((prev) => ({
          ...prev,
          status: data.status,
          output: data.output,
          error: data.error,
          isRunning: data.status === "pending" || data.status === "running",
        }));

        if (data.status === "pending" || data.status === "running") {
          pollTimerRef.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
        } else {
          stopPolling();
        }
      } catch {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: "Network error while polling apply status",
          isRunning: false,
        }));
        stopPolling();
      }
    },
    [stopPolling],
  );

  // Resume polling on mount if a job was in-flight when the page loaded (e.g. after page refresh)
  useEffect(() => {
    if (initialIsRunning && initial.applyJobId) {
      pollTimerRef.current = setTimeout(() => poll(initial.applyJobId!), POLL_INTERVAL_MS);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — poll and stopPolling are stable

  const runApply = useCallback(
    async (opts: {
      credentialProfileId?: string;
      oneOffCredentials?: Record<string, string>;
    }) => {
      stopPolling();
      setState({ jobId: null, status: "pending", output: "", error: null, isRunning: true });

      try {
        const res = await fetch("/api/deploy/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...opts }),
        });

        const data = await res.json() as { jobId?: string; error?: string };

        if (!res.ok) {
          setState({ jobId: null, status: "failed", output: "", error: data.error ?? "Apply failed", isRunning: false });
          return;
        }

        const { jobId } = data;
        if (!jobId) {
          setState({ jobId: null, status: "failed", output: "", error: "No job ID returned", isRunning: false });
          return;
        }

        setState((prev) => ({ ...prev, jobId }));
        pollTimerRef.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
      } catch {
        setState({ jobId: null, status: "failed", output: "", error: "Network error", isRunning: false });
      }
    },
    [sessionId, poll, stopPolling],
  );

  return { ...state, runApply };
}
