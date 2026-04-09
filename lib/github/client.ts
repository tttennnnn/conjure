import { createClient } from "@/lib/supabase/server";

// TODO: Implement GitHub API helpers using the user's OAuth token from Supabase Auth.
//
// Supabase stores the GitHub OAuth token as part of the user's auth session.
// Retrieve it via:
//   const supabase = await createClient();
//   const { data: { session } } = await supabase.auth.getSession();
//   const githubToken = session?.provider_token;
//
// Use the GitHub REST API (https://api.github.com) with that token.
// Do NOT install octokit — use fetch with Authorization header to keep deps minimal.

export interface GitHubRepo {
  id: number;
  fullName: string; // "owner/repo"
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

const GITHUB_API_BASE = "https://api.github.com";

type GitHubApiUserResponse = {
  login: string;
  avatar_url: string | null;
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
        message = data.message;
      }
    } catch {
      // Ignore JSON parse issues and keep fallback error message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

/** Check whether the current user has a valid GitHub connection. */
export async function getGitHubStatus(): Promise<{
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { connected: false, username: null, avatarUrl: null };
  }

  const hasGitHubIdentity =
    user?.identities?.some((identity) => identity.provider === "github") ?? false;

  if (!hasGitHubIdentity) {
    return { connected: false, username: null, avatarUrl: null };
  }

  const token = await getGitHubToken();
  if (token) {
    try {
      const ghUser = await githubFetch<GitHubApiUserResponse>("/user", token);
      return {
        connected: true,
        username: ghUser.login ?? null,
        avatarUrl: ghUser.avatar_url ?? null,
      };
    } catch {
      // Fall back to identity data when token is unavailable/expired.
    }
  }

  const identity = user.identities?.find((item) => item.provider === "github");
  const identityData = (identity?.identity_data ?? {}) as Record<string, unknown>;

  const username =
    (typeof identityData.user_name === "string" && identityData.user_name) ||
    (typeof identityData.preferred_username === "string" && identityData.preferred_username) ||
    (typeof identityData.login === "string" && identityData.login) ||
    null;

  const avatarUrl =
    (typeof identityData.avatar_url === "string" && identityData.avatar_url) ||
    (typeof user.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url) ||
    null;

  return { connected: true, username, avatarUrl };
}

/** List repositories the authenticated GitHub user has access to. */
export async function listUserRepos(): Promise<GitHubRepo[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("GITHUB_NOT_CONNECTED");
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
    .filter((repo) => repo.permissions?.push === true)
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
    const ref = await githubFetch<{ object: { sha: string } }>(
      `${basePath}/git/ref/heads/${encodeURIComponent(params.branch)}`,
      token,
    );

    const tree = await githubFetch<{ sha: string }>(`${basePath}/git/trees`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: ref.object.sha,
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
        parents: [ref.object.sha],
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
