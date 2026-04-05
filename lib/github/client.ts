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
  full_name: string; // "owner/repo"
  private: boolean;
  default_branch: string;
  html_url: string;
}

/** Check whether the current user has a valid GitHub connection. */
export async function getGitHubStatus(): Promise<{
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
}> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // TODO: Check if provider_token exists and is valid (may need a test API call).
  // Supabase only returns provider_token on the initial OAuth sign-in.
  // For persisted access, you may need to store the token separately or
  // use Supabase's auth.getUser() to check identity providers.
  void session;

  return { connected: false, username: null, avatarUrl: null };
}

/** List repositories the authenticated GitHub user has access to. */
export async function listUserRepos(): Promise<GitHubRepo[]> {
  // TODO: Fetch from GET https://api.github.com/user/repos
  // - Sort by pushed_at (most recently active first)
  // - Paginate if needed (default 30 per page, max 100)
  // - Filter to repos where user has push access (permissions.push === true)
  return [];
}

/** Create a pull request on a GitHub repository. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createPullRequest(_params: {
  repo: string; // "owner/repo"
  title: string;
  body: string;
  head: string; // branch name
  base: string; // target branch (usually "main")
}): Promise<{ url: string } | { error: string }> {
  // TODO: POST https://api.github.com/repos/{owner}/{repo}/pulls
  return { error: "Not implemented" };
}

/** Push files to a branch on a GitHub repository. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function pushFiles(_params: {
  repo: string; // "owner/repo"
  branch: string;
  message: string;
  files: { path: string; content: string }[];
}): Promise<{ sha: string } | { error: string }> {
  // TODO: Use the Git Trees API to push multiple files in one commit:
  // 1. GET /repos/{owner}/{repo}/git/ref/heads/{branch} — get current SHA
  // 2. POST /repos/{owner}/{repo}/git/trees — create tree with file blobs
  // 3. POST /repos/{owner}/{repo}/git/commits — create commit
  // 4. PATCH /repos/{owner}/{repo}/git/refs/heads/{branch} — update ref
  return { error: "Not implemented" };
}
