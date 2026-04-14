const express = require("express");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.DEPLOY_SERVICE_API_KEY;
const MAX_CONCURRENT_JOBS = 5;
const HARD_TIMEOUT_MS = 5 * 60 * 1000; // 5 min — kill terraform if it hangs
const COMPLETED_TTL_MS = 10 * 60 * 1000; // 10 min — keep finished jobs for polling

// In-memory job store: jobId -> { status, output, error, createdAt, completedAt, process }
const jobs = new Map();

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    // Only reachable if ALLOW_NO_AUTH=true was set at startup
    return next();
  }
  const auth = req.headers["authorization"];
  if (!auth || auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.use(requireApiKey);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function validateJobRequest(body) {
  const { hcl, provider, credentials, region } = body;
  if (!hcl || typeof hcl !== "object") {
    return "hcl must be an object of filename -> content";
  }
  if (provider !== "aws" && provider !== "gcp") {
    return "provider must be 'aws' or 'gcp'";
  }
  if (!credentials || typeof credentials !== "object") {
    return "credentials required";
  }
  if (typeof region !== "string" || region.length === 0) {
    return "region required";
  }
  return null;
}

function checkConcurrencyLimit() {
  const active = [...jobs.values()].filter(
    (j) => j.status === "pending" || j.status === "running",
  ).length;
  return active >= MAX_CONCURRENT_JOBS;
}

function createJob() {
  const jobId = randomUUID();
  const jobDir = path.join("/tmp/jobs", jobId);
  jobs.set(jobId, {
    status: "pending",
    output: "",
    error: null,
    createdAt: Date.now(),
    completedAt: null,
    process: null,
  });
  return { jobId, jobDir };
}

function writeHclFiles(jobDir, hcl) {
  fs.mkdirSync(jobDir, { recursive: true });
  for (const [filename, content] of Object.entries(hcl)) {
    const safe = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, "_");
    if (!safe.endsWith(".tf")) continue;
    fs.writeFileSync(path.join(jobDir, safe), content, "utf8");
  }
}

// Reject values that could break HCL string interpolation
function sanitizeHclValue(value) {
  if (typeof value !== "string") return false;
  return !/["\\\$\{]/.test(value);
}

function writeBackendTf(jobDir, provider, stateBackend) {
  const fields = Object.entries(stateBackend).filter(([k]) => k !== "type");
  for (const [key, val] of fields) {
    if (!sanitizeHclValue(val)) {
      throw new Error(`Invalid character in state backend field "${key}"`);
    }
  }

  let hcl;
  if (provider === "aws") {
    const lines = [
      `    bucket         = "${stateBackend.bucket}"`,
      `    key            = "${stateBackend.keyPrefix}"`,
      `    region         = "${stateBackend.region}"`,
    ];
    if (stateBackend.dynamodbTable) {
      lines.push(`    dynamodb_table = "${stateBackend.dynamodbTable}"`);
    }
    hcl = `terraform {\n  backend "s3" {\n${lines.join("\n")}\n  }\n}`;
  } else {
    const lines = [
      `    bucket = "${stateBackend.bucket}"`,
      `    prefix = "${stateBackend.prefix}"`,
    ];
    hcl = `terraform {\n  backend "gcs" {\n${lines.join("\n")}\n  }\n}`;
  }

  fs.writeFileSync(path.join(jobDir, "backend.tf"), hcl, "utf8");
}

function buildTerraformEnv(provider, credentials, region, jobDir) {
  // Minimal allowlist — never inherit process.env so service secrets (e.g. DEPLOY_SERVICE_API_KEY)
  // cannot leak into user-controlled Terraform code execution.
  // HOME is set to jobDir (not the container home) so Terraform cannot find credential files
  // at well-known paths (~/.aws/credentials, ~/.config/gcloud/) in the service container.
  const minimal = {
    PATH: process.env.PATH,
    HOME: jobDir,
    TF_INPUT: "false",
    TF_IN_AUTOMATION: "true",
  };

  if (provider === "aws") {
    return {
      ...minimal,
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_DEFAULT_REGION: region,
    };
  }

  // GCP: write SA JSON inside the job dir so cleanup() deletes it
  const saPath = path.join(jobDir, "sa.json");
  fs.writeFileSync(saPath, credentials.serviceAccountJson, "utf8");
  return {
    ...minimal,
    GOOGLE_APPLICATION_CREDENTIALS: saPath,
    GOOGLE_REGION: region,
  };
}

function runCommand(cmd, args, cwd, env, job) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, env, stdio: "pipe" });
    job.process = proc;
    let output = "";

    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    proc.on("close", (code) => {
      job.process = null;
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `${cmd} exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      job.process = null;
      reject(new Error(`Failed to start ${cmd}: ${err.message}`));
    });
  });
}

function finalizeJob(job, status, error) {
  job.status = status;
  if (error) {
    job.error = error;
    job.output += `\nError: ${error}`;
  }
  job.completedAt = Date.now();
  job.process = null;
}

// ---------------------------------------------------------------------------
// POST /jobs/plan
// ---------------------------------------------------------------------------

app.post("/jobs/plan", async (req, res) => {
  const validationError = validateJobRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  if (checkConcurrencyLimit()) {
    return res.status(429).json({ error: "Too many concurrent jobs" });
  }

  const { hcl, provider, credentials, region, stateBackend } = req.body;
  const { jobId, jobDir } = createJob();

  res.json({ jobId });
  runTerraformJob({
    jobId, jobDir, hcl, provider, credentials, region, stateBackend,
    command: ["plan", "-no-color", "-input=false"],
  });
});

// ---------------------------------------------------------------------------
// POST /jobs/apply
// ---------------------------------------------------------------------------

app.post("/jobs/apply", async (req, res) => {
  const validationError = validateJobRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { stateBackend } = req.body;
  if (!stateBackend || typeof stateBackend !== "object") {
    return res.status(400).json({ error: "stateBackend required for apply" });
  }

  if (checkConcurrencyLimit()) {
    return res.status(429).json({ error: "Too many concurrent jobs" });
  }

  const { hcl, provider, credentials, region } = req.body;
  const { jobId, jobDir } = createJob();

  res.json({ jobId });
  runTerraformJob({
    jobId, jobDir, hcl, provider, credentials, region, stateBackend,
    command: ["apply", "-auto-approve", "-no-color", "-input=false"],
  });
});

// ---------------------------------------------------------------------------
// GET /jobs/:jobId
// ---------------------------------------------------------------------------

app.get("/jobs/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json({ status: job.status, output: job.output, error: job.error });
});

// ---------------------------------------------------------------------------
// Unified terraform execution
// ---------------------------------------------------------------------------

async function runTerraformJob({ jobId, jobDir, hcl, provider, credentials, region, stateBackend, command }) {
  const job = jobs.get(jobId);

  try {
    writeHclFiles(jobDir, hcl);

    if (stateBackend) {
      writeBackendTf(jobDir, provider, stateBackend);
    }

    const tfEnv = buildTerraformEnv(provider, credentials, region, jobDir);
    job.status = "running";

    const initOutput = await runCommand("terraform", ["init", "-no-color", "-input=false"], jobDir, tfEnv, job);
    job.output += initOutput;

    const cmdOutput = await runCommand("terraform", command, jobDir, tfEnv, job);
    job.output += cmdOutput;

    finalizeJob(job, "completed", null);
  } catch (err) {
    finalizeJob(job, "failed", err.message || "Unknown error");
  } finally {
    // Schedule temp dir cleanup after TTL from completion
    setTimeout(() => cleanup(jobId, jobDir), COMPLETED_TTL_MS);
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function cleanup(jobId, jobDir) {
  jobs.delete(jobId);
  try {
    fs.rmSync(jobDir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}

// Periodic sweeper: timeout runaway jobs, clean up old completed ones
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (job.status === "completed" || job.status === "failed") {
      // Clean up terminal jobs after TTL from completion
      if (job.completedAt && now - job.completedAt > COMPLETED_TTL_MS) {
        cleanup(jobId, path.join("/tmp/jobs", jobId));
      }
    } else {
      // Kill runaway non-terminal jobs past hard timeout
      if (now - job.createdAt > HARD_TIMEOUT_MS) {
        if (job.process) {
          try { job.process.kill("SIGTERM"); } catch { /* already exited */ }
        }
        finalizeJob(job, "failed", "Job timed out");
      }
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

if (!API_KEY && process.env.ALLOW_NO_AUTH !== "true") {
  console.error(
    "FATAL: DEPLOY_SERVICE_API_KEY not set. Set ALLOW_NO_AUTH=true for local dev.",
  );
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`conjure-deploy-service listening on port ${PORT}`);
  if (!API_KEY) {
    console.warn("WARNING: Running without auth (ALLOW_NO_AUTH=true)");
  }
});
