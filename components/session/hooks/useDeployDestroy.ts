import { useState, useCallback, useRef, useEffect } from "react";
import type { DestroyStatus, DestroyStatusResponse } from "@/app/api/deploy/destroy/status/route";

const POLL_INTERVAL_MS = 2500;

export interface DeployDestroyState {
  jobId: string | null;
  status: DestroyStatus | null;
  output: string;
  error: string | null;
  isRunning: boolean;
}

export function useDeployDestroy(
  sessionId: string,
  initial: { lastDestroyStatus: string | null; lastDestroyOutput: string | null; destroyJobId: string | null },
) {
  const initialStatus = (initial.lastDestroyStatus as DestroyStatus) ?? null;
  const initialIsRunning = initialStatus === "pending" || initialStatus === "running";

  const [state, setState] = useState<DeployDestroyState>({
    jobId: initial.destroyJobId ?? null,
    status: initialStatus,
    output: initial.lastDestroyOutput ?? "",
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
        const res = await fetch(`/api/deploy/destroy/status?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: err.error ?? "Failed to fetch destroy status",
            isRunning: false,
          }));
          stopPolling();
          return;
        }

        const data: DestroyStatusResponse = await res.json();
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
          error: "Network error while polling destroy status",
          isRunning: false,
        }));
        stopPolling();
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    if (initialIsRunning && initial.destroyJobId) {
      pollTimerRef.current = setTimeout(() => poll(initial.destroyJobId!), POLL_INTERVAL_MS);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  const runDestroy = useCallback(
    async (opts: {
      credentialProfileId?: string;
      oneOffCredentials?: Record<string, string>;
    }) => {
      stopPolling();
      setState({ jobId: null, status: "pending", output: "", error: null, isRunning: true });

      try {
        const res = await fetch("/api/deploy/destroy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...opts }),
        });

        const data = await res.json() as { jobId?: string; error?: string };

        if (!res.ok) {
          setState({ jobId: null, status: "failed", output: "", error: data.error ?? "Destroy failed", isRunning: false });
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

  return { ...state, runDestroy };
}
