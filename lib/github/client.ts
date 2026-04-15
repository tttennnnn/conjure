import { createClient } from "@/lib/supabase/server";
import { isValidGithubRepo } from "@/lib/sessions/validation";

export interface GitHubRepo {
  id: number;
  fullName: string; // "owner/repo"
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface GitHubBranch {
  name: string;
  sha: string;
}

export interface GitHubStatus {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
}

export class GitHubNotConnectedError extends Error {
  constructor() {
    super("GitHub is not connected");
  }
}

const GITHUB_API_BASE = "https://api.github.com";

type GitHubApiUserResponse = {
  login: string;
  avatar_url: string | null;
};

type GitHubApiBranchResponse = {
  name: string;
  commit: { sha: string };
};

type GitHubApiTreeResponse = {
  tree: { path: string; type: string }[];
  truncated: boolean;
};

type GitHubApiContentEntry = {
  name: string;
  type: string;
};

type GitHubApiFileContent = {
  type: string;
  encoding: string;
  content: string;
  name: string;
  path: string;
};

type GitHubApiRepoResponse = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  pushed_at?: string;
  permissions?: {
    push?: boolean;
  };
};

async function getGitHubToken() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.provider_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function parseRepo(repo: string): { owner: string; name: string } | null {
  if (!isValidGithubRepo(repo)) return null;
  const [owner, name] = repo.split("/");
  if (!owner || !name) return null;
  return { owner, name };
}

async function githubFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "conjure-app",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `GitHub API request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data && typeof data.message === "string" && data.message.length > 0) {
        message = `GitHub API request failed (${response.status}): ${data.message}`;
      }
    } catch {
      // Ignore JSON parse issues and keep fallback error message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

/** Check whether the current user has a valid GitHub connection. */
export async function getGitHubStatus(): Promise<GitHubStatus> {
  const supabase = await createClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  if (!user) {
    return { connected: false, username: null, avatarUrl: null };
  }

  const hasGitHubIdentity =
    user?.identities?.some((identity) => identity.provider === "github") ?? false;

  if (!hasGitHubIdentity) {
    return { connected: false, username: null, avatarUrl: null };
  }

  const token = session?.provider_token;
  if (typeof token !== "string" || token.length === 0) {
    // Token missing — treat as disconnected so the user is prompted to reconnect.
    return { connected: false, username: null, avatarUrl: null };
  }

  try {
    const ghUser = await githubFetch<GitHubApiUserResponse>("/user", token);
    return {
      connected: true,
      username: ghUser.login ?? null,
      avatarUrl: ghUser.avatar_url ?? null,
    };
  } catch {
    // Token expired or revoked — treat as disconnected.
    return { connected: false, username: null, avatarUrl: null };
  }
}

/**
 * Returns true for errors that should surface to the caller (rate limits, auth failures)
 * rather than being silently swallowed on a per-branch basis.
 */
function isRetryableGitHubError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("rate limit") ||
    msg.includes("api rate limit exceeded")
  );
}

/**
 * Check the root directory of a branch for any .tf files.
 * Used as a fallback when the recursive tree response is truncated.
 * The contents listing is never truncated — it only covers one directory level.
 */
async function checkRootForTf(basePath: string, branchName: string, token: string): Promise<boolean> {
  try {
    const entries = await githubFetch<GitHubApiContentEntry[]>(
      `${basePath}/contents?ref=${encodeURIComponent(branchName)}`,
      token,
    );
    return Array.isArray(entries) && entries.some((e) => e.type === "file" && e.name.endsWith(".tf"));
  } catch {
    return false;
  }
}

/**
 * List repositories the authenticated GitHub user has access to.
 *
 * @param purpose
 *   "import" — include all accessible repos (read access is sufficient).
 *   "export" — restrict to repos where the user has push access (needed to open PRs / push branches).
 *   Defaults to "import".
 */
export async function listUserRepos(purpose: "import" | "export" = "import"): Promise<GitHubRepo[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new GitHubNotConnectedError();
  }

  const repos: GitHubApiRepoResponse[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= 10) {
    const pageRepos = await githubFetch<GitHubApiRepoResponse[]>(
      `/user/repos?per_page=${perPage}&page=${page}&sort=pushed&direction=desc`,
      token,
    );

    repos.push(...pageRepos);
    if (pageRepos.length < perPage) break;
    page += 1;
  }

  return repos
    .filter((repo) => purpose === "export" ? repo.permissions?.push === true : true)
    .sort((a, b) => {
      const aDate = a.pushed_at ? Date.parse(a.pushed_at) : 0;
      const bDate = b.pushed_at ? Date.parse(b.pushed_at) : 0;
      return bDate - aDate;
    })
    .map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
    }));
}

/** List branches of a repo that contain at least one .tf file. */
export async function listRepoBranchesWithTf(repo: string): Promise<GitHubBranch[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new GitHubNotConnectedError();
  }

  const parsed = parseRepo(repo);
  if (!parsed) {
    throw new Error("Invalid repository. Expected format: owner/repo");
  }

  const basePath = `/repos/${parsed.owner}/${parsed.name}`;

  // Paginate branches — up to 1000 (10 pages × 100).
  const branches: GitHubApiBranchResponse[] = [];
  let branchPage = 1;
  while (branchPage <= 10) {
    const pageBranches = await githubFetch<GitHubApiBranchResponse[]>(
      `${basePath}/branches?per_page=100&page=${branchPage}`,
      token,
    );
    branches.push(...pageBranches);
    if (pageBranches.length < 100) break;
    branchPage += 1;
  }

  // Check each branch for .tf files, 5 at a time to avoid hammering the API.
  const BATCH_SIZE = 5;
  const results: (GitHubBranch | null)[] = [];

  for (let i = 0; i < branches.length; i += BATCH_SIZE) {
    const batch = branches.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (branch) => {
        try {
          // Use the branch name as a ref — the tree endpoint accepts ref names directly.
          // (branch.commit.sha is a commit SHA, not a tree SHA, and would fail.)
          const tree = await githubFetch<GitHubApiTreeResponse>(
            `${basePath}/git/trees/${encodeURIComponent(branch.name)}?recursive=1`,
            token,
          );

          let hasTf: boolean;
          if (!tree.truncated) {
            hasTf = tree.tree.some((entry) => entry.type === "blob" && entry.path.endsWith(".tf"));
          } else {
            // Tree is truncated — recursive listing is incomplete. Fall back to checking
            // the root directory via the contents API, which is never truncated.
            hasTf = await checkRootForTf(basePath, branch.name, token);
          }

          return hasTf ? { name: branch.name, sha: branch.commit.sha } : null;
        } catch (error) {
          // Rate-limit or auth failures must surface so the user isn't shown "no branches found".
          if (isRetryableGitHubError(error)) throw error;
          return null;
        }
      }),
    );
    results.push(...batchResults);
  }

  return results.filter((b): b is GitHubBranch => b !== null);
}

/** Create a pull request on a GitHub repository. */
export async function createPullRequest(params: {
  repo: string; // "owner/repo"
  title: string;
  body: string;
  head: string; // branch name
  base: string; // target branch (usually "main")
}): Promise<{ url: string } | { error: string }> {
  const token = await getGitHubToken();
  if (!token) {
    return { error: "GitHub is not connected" };
  }

  const parsed = parseRepo(params.repo);
  if (!parsed) {
    return { error: "Invalid repository. Expected format: owner/repo" };
  }

  try {
    const result = await githubFetch<{ html_url: string }>(
      `/repos/${parsed.owner}/${parsed.name}/pulls`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          head: params.head,
          base: params.base,
        }),
      },
    );

    return { url: result.html_url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create pull request";
    return { error: message };
  }
}

/**
 * List all .tf file paths in a repo branch.
 * Uses the git tree API (recursive) for efficiency; falls back to root contents on truncation.
 */
export async function listTfFiles(repo: string, branch: string): Promise<string[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new GitHubNotConnectedError();
  }

  const parsed = parseRepo(repo);
  if (!parsed) {
    throw new Error("Invalid repository. Expected format: owner/repo");
  }

  const basePath = `/repos/${parsed.owner}/${parsed.name}`;

  try {
    const tree = await githubFetch<GitHubApiTreeResponse>(
      `${basePath}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      token,
    );

    if (!tree.truncated) {
      return tree.tree
        .filter((entry) => entry.type === "blob" && entry.path.endsWith(".tf"))
        .map((entry) => entry.path);
    }

    // Tree truncated — fall back to checking root directory only
    const entries = await githubFetch<GitHubApiContentEntry[]>(
      `${basePath}/contents?ref=${encodeURIComponent(branch)}`,
      token,
    );
    return Array.isArray(entries)
      ? entries.filter((e) => e.type === "file" && e.name.endsWith(".tf")).map((e) => e.name)
      : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list .tf files";
    throw new Error(message);
  }
}

/**
 * Read the UTF-8 content of a single file from a repo branch.
 * Uses the GitHub contents API (base64 encoded response).
 */
export async function getFileContent(repo: string, branch: string, filePath: string): Promise<string> {
  const token = await getGitHubToken();
  if (!token) {
    throw new GitHubNotConnectedError();
  }

  const parsed = parseRepo(repo);
  if (!parsed) {
    throw new Error("Invalid repository. Expected format: owner/repo");
  }

  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const result = await githubFetch<GitHubApiFileContent>(
    `/repos/${parsed.owner}/${parsed.name}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
    token,
  );

  if (result.type !== "file" || result.encoding !== "base64") {
    throw new Error(`Unexpected content type for ${filePath}`);
  }

  // GitHub wraps base64 content in newlines — strip them before decoding
  const clean = result.content.replace(/\n/g, "");
  return Buffer.from(clean, "base64").toString("utf8");
}

/** Push files to a branch on a GitHub repository. */
export async function pushFiles(params: {
  repo: string; // "owner/repo"
  branch: string;
  message: string;
  files: { path: string; content: string }[];
}): Promise<{ sha: string } | { error: string }> {
  if (params.files.length === 0) {
    return { error: "No files provided" };
  }

  const token = await getGitHubToken();
  if (!token) {
    return { error: "GitHub is not connected" };
  }

  const parsed = parseRepo(params.repo);
  if (!parsed) {
    return { error: "Invalid repository. Expected format: owner/repo" };
  }

  const basePath = `/repos/${parsed.owner}/${parsed.name}`;

  try {
    // Resolve the head SHA for the target branch — create the branch if it doesn't exist yet.
    let headSha: string;
    try {
      const ref = await githubFetch<{ object: { sha: string } }>(
        `${basePath}/git/ref/heads/${encodeURIComponent(params.branch)}`,
        token,
      );
      headSha = ref.object.sha;
    } catch (refError) {
      // Branch not found — create it from the repo's default branch.
      if (!(refError instanceof Error && refError.message.includes("404"))) throw refError;
      const repoInfo = await githubFetch<{ default_branch: string }>(basePath, token);
      const baseRef = await githubFetch<{ object: { sha: string } }>(
        `${basePath}/git/ref/heads/${encodeURIComponent(repoInfo.default_branch)}`,
        token,
      );
      headSha = baseRef.object.sha;
      await githubFetch(`${basePath}/git/refs`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/heads/${params.branch}`, sha: headSha }),
      });
    }

    const headCommit = await githubFetch<{ tree: { sha: string } }>(
      `${basePath}/git/commits/${headSha}`,
      token,
    );

    const tree = await githubFetch<{ sha: string }>(`${basePath}/git/trees`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: headCommit.tree.sha,
        tree: params.files.map((file) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.content,
        })),
      }),
    });

    const commit = await githubFetch<{ sha: string }>(`${basePath}/git/commits`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        tree: tree.sha,
        parents: [headSha],
      }),
    });

    await githubFetch<{ ref: string; object: { sha: string } }>(
      `${basePath}/git/refs/heads/${encodeURIComponent(params.branch)}`,
      token,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commit.sha, force: false }),
      },
    );

    return { sha: commit.sha };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to push files";
    return { error: message };
  }
}
