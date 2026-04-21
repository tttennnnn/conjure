import { useState, useCallback, useRef, useEffect } from "react";
import type { PlanStatus, PlanStatusResponse } from "@/app/api/deploy/plan/status/route";

const POLL_INTERVAL_MS = 2500;

export interface DeployPlanState {
  jobId: string | null;
  status: PlanStatus | null;
  output: string;
  error: string | null;
  isRunning: boolean;
  planRegion: string | null;
  planCredentialProfileId: string | null;
}

export function useDeployPlan(
  sessionId: string,
  initial: {
    lastPlanStatus: string | null;
    lastPlanOutput: string | null;
    deployJobId: string | null;
    planRegion: string | null;
    planCredentialProfileId: string | null;
  },
) {
  const initialStatus = (initial.lastPlanStatus as PlanStatus) ?? null;
  const initialIsRunning = initialStatus === "pending" || initialStatus === "running";

  const [state, setState] = useState<DeployPlanState>({
    jobId: initial.deployJobId ?? null,
    status: initialStatus,
    output: initial.lastPlanOutput ?? "",
    error: null,
    isRunning: initialIsRunning,
    planRegion: initial.planRegion,
    planCredentialProfileId: initial.planCredentialProfileId,
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
        const res = await fetch(`/api/deploy/plan/status?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: err.error ?? "Failed to fetch plan status",
            isRunning: false,
          }));
          stopPolling();
          return;
        }

        const data: PlanStatusResponse = await res.json();
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
          error: "Network error while polling plan status",
          isRunning: false,
        }));
        stopPolling();
      }
    },
    [stopPolling],
  );

  // Resume polling on mount if a job was in-flight when the page loaded (e.g. after page refresh)
  useEffect(() => {
    if (initialIsRunning && initial.deployJobId) {
      pollTimerRef.current = setTimeout(() => poll(initial.deployJobId!), POLL_INTERVAL_MS);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — poll and stopPolling are stable

  const runPlan = useCallback(
    async (opts: {
      credentialProfileId?: string;
      oneOffCredentials?: Record<string, string>;
      region: string;
      stateBackend?: Record<string, unknown>;
    }) => {
      stopPolling();
      setState({
        jobId: null,
        status: "pending",
        output: "",
        error: null,
        isRunning: true,
        planRegion: opts.region,
        planCredentialProfileId: opts.credentialProfileId ?? null,
      });

      try {
        const res = await fetch("/api/deploy/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...opts }),
        });

        const data = await res.json() as { jobId?: string; error?: string };

        if (!res.ok) {
          setState((prev) => ({ ...prev, jobId: null, status: "failed", output: "", error: data.error ?? "Plan failed", isRunning: false }));
          return;
        }

        const { jobId } = data;
        if (!jobId) {
          setState((prev) => ({ ...prev, jobId: null, status: "failed", output: "", error: "No job ID returned", isRunning: false }));
          return;
        }

        setState((prev) => ({ ...prev, jobId }));
        pollTimerRef.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
      } catch {
        setState((prev) => ({ ...prev, jobId: null, status: "failed", output: "", error: "Network error", isRunning: false }));
      }
    },
    [sessionId, poll, stopPolling],
  );

  return { ...state, runPlan };
}
