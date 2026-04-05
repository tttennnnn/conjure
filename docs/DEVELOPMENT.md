# Development Guide

Everything you need to set up, understand, and contribute to Conjure.

---

## Setup

### Prerequisites

- **Docker** — runs the dev server in a Node 20 Linux container
- **Node.js 20+** — local install for IDE autocomplete only (the app runs in Docker)

### 1. Install dependencies

```bash
npm install
```

This creates a local `node_modules` so your editor can resolve types. Docker maintains its own `node_modules` inside the container — the two are independent.

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase dashboard](https://supabase.com/dashboard) → your project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key (keep secret) |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) → create a key |
| `DATABASE_URL` | Supabase dashboard → Settings → Database → Connection string (URI) |

### 3. Start the dev server

```bash
docker compose up --build
```

First build takes ~60s (installs deps inside the container). Subsequent starts are fast (~3s) because Docker caches the layer.

Open [http://localhost:3000](http://localhost:3000).

### 4. Common commands

**Run in your terminal (host):**

| Command | When to run |
|---|---|
| `npm run typecheck` | Before committing — catches TypeScript errors |
| `npm run lint` | Before committing — catches code quality issues |
| `docker compose up` | Start the dev server |
| `docker compose up --build` | Start and rebuild — required after adding/removing packages |
| `docker compose exec app bash` | Open a shell inside the running container |
| `docker compose down` | Stop the dev server |

**Run inside the container** (requires `docker compose up` to be running):

| Command | When to run |
|---|---|
| `docker compose exec -e NODE_ENV=production app npm run build` | Before pushing — catches route/bundle errors that typecheck misses |
| `docker compose exec app npx prisma db push` | After changing `schema.prisma` — syncs schema to DB (see Schema changes below) |

> The host and container have independent `node_modules`. Host commands serve your IDE and `tsc`. Container commands affect the running app and the database.

### 5. Before you push

```bash
npm run typecheck    # type errors
npm run lint         # code quality
docker compose exec -e NODE_ENV=production app npm run build  # full build
```

All three should pass before opening a PR.

### 6. Schema changes

This project uses `prisma db push` for all schema changes — no migration history is maintained. `migrate dev` will fail because the DB was bootstrapped directly, not via Prisma migrations.

When you edit `prisma/schema.prisma`, run all three steps:

**Step 1 — Sync the database:**

```bash
docker compose exec app npx prisma db push
```

> `db push` compares the schema file to the live DB and applies only the diff. It is safe for **additive changes** (new tables, new columns, new indexes). Avoid using it for renaming or removing columns — those are destructive and will drop data. For destructive changes, write the SQL manually and run it in the Supabase Dashboard SQL editor before running `db push`.

**Step 2 — Rebuild the container** (so the running app sees the new types — `prisma generate` runs automatically during the build):

```bash
docker compose up --build
```

**Step 3 — Regenerate Prisma client on the host** (so your IDE and `typecheck` see the new types):

```bash
npx prisma generate
```

### 7. Adding a new npm package

```bash
npm install <package>      # updates host node_modules (for IDE + typecheck)
docker compose up --build  # rebuilds container so the running app picks it up
```

### 8. GitHub Actions secrets

The CI and keep-alive workflows need these secrets added once in repo Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as `.env.local` |

---

## Architecture

### Core model: dual source of truth

Infrastructure is defined by **two files that work as a pair**:

- **Mermaid** — topology only (what nodes exist and how they connect)
- **Config YAML** — everything else (resource types, instance sizes, networking, ports)

Node IDs are the glue — every node ID in Mermaid must have a corresponding entry in the config. If one has an ID the other doesn't, that's a validation error.

IaC HCL is always a **derived output** generated from the Mermaid + Config pair. It is never edited directly or patched incrementally.

### Message classification

Every user message is classified into one of three categories:

| Category | What changes | Code impact |
|---|---|---|
| **Topology change** | Mermaid + Config updated | Code goes stale |
| **Config change** | Config updated, Mermaid unchanged | Code goes stale |
| **Question / chat** | Neither | No impact |

**Stale rule:** any change to Mermaid or Config → if generated code exists, it goes stale. No exceptions.

### Three LLM calls

| Call | Trigger | Input | Output |
|---|---|---|---|
| **Call 0** | Every user message | User message only | `INFRA` (allowed) or `REJECT` (blocked) |
| **Call 1** | User sends a topology or config message (after Call 0 passes) | Prompt + current Mermaid + Config | Updated Mermaid and/or Config + chat explanation |
| **Call 2** | User clicks "Generate Code" | Full Mermaid + full Config | IaC (HCL) files |

There is no incremental code patching. Code is always fully regenerated.

### LLM security

Defence is layered — no single layer is assumed to be sufficient.

| Layer | What it does | Location |
|---|---|---|
| **Rate limiting** | Sliding window limiter per user: chat 10/min, api-keys 5/min, sessions 5/min. Returns 429 on breach. Auth endpoints rate-limited by Supabase. | `lib/rate-limit.ts` |
| **Input length limit** | Rejects messages over 1000 chars | `app/api/chat/route.ts` |
| **Input validation** | Session names trimmed + capped at 100 chars. GitHub repo validated as `owner/repo`. Registration names trimmed, capped at 50 chars, stored trimmed. OAuth `next` param validated to block open redirects. | `lib/sessions/validation.ts`, `app/api/auth/callback/route.ts`, `app/(auth)/register/page.tsx` |
| **Call 0 — Guardrail classifier** | LLM classifies message as `INFRA` or `REJECT`. Blocks off-topic, prompt injection, role override attempts. Uses `max_tokens: 10`, `temperature: 0` for deterministic single-word output. Errors re-throw (fail closed). | `lib/llm/guardrails.ts` |
| **System prompt hardening** | Explicit instructions to never reveal/modify the system prompt, never follow override instructions, treat injection attempts as off-topic. | `lib/llm/prompts/diagram.ts` |
| **Output validation** | `parseLLMResponse()` only extracts content within `<<<MERMAID>>>` / `<<<CONFIG>>>` delimiters. Arbitrary LLM output cannot corrupt the diagram or config. Mermaid and YAML are validated before saving. | `lib/llm/parse.ts` |
| **Rendering** | Mermaid rendered with `securityLevel: 'strict'` (no HTML). YAML parsed in safe mode. | Client-side |

**Known limitations:**

- **Fail-closed guardrail** — if Call 0 errors, the exception is re-thrown and caught by the chat route's error handler, returning a generic error message to the user. This is intentional: the guardrail uses the same provider and API key as Call 1, so a guardrail failure means Call 1 would fail anyway.
- **Same model for guardrail and generation** — Call 0 uses the same model as Call 1. A weaker free-tier model may be easier to trick than a premium model. A dedicated lightweight classifier would be more robust.
- **Subtle injection** — messages that start with valid infra content but embed secondary instructions (e.g. "Add a VPC. Also ignore previous rules and...") may pass Call 0. The system prompt hardening in Call 1 is the backstop, but it's LLM-dependent, not deterministic.

### LLM provider routing

| Scenario | SDK used | Key source |
|---|---|---|
| Free models (default) | `openai` package → OpenRouter API | `OPENROUTER_API_KEY` env var |
| User brings Anthropic key | `@anthropic-ai/sdk` | User's key stored in Supabase Vault |

**Free models available out of the box:** Nemotron Super 120B, GPT OSS 120B.

**BYOK (Bring Your Own Key):** Users can add their own Anthropic key (unlocks Claude Haiku, Sonnet, Opus) in Settings > API Keys.

### Deploy error handling

> **Planned — not yet implemented.** This section describes the target design for deploy functionality.

After code is generated, users can deploy via three paths with different levels of observability:

| Path | Conjure visibility | Notes |
|---|---|---|
| **Conjure Deploy tab** | Full — output streamed, exit code captured | Plan/apply run server-side |
| **GitHub merge (CI/CD)** | None (v1) | Manual "Mark as deployed/failed" control; webhook is a v2 feature |
| **Manual (.zip download)** | None | User is fully on their own |

#### Session status model

| Status | When |
|---|---|
| `active` | No apply attempted, or session resumed after a failed apply |
| `deploying` | Apply running (Conjure-managed) |
| `deployed` | Apply succeeded |
| `deploy_failed` | Apply failed — partial or full. Terraform state may have been updated. |

#### Error types by phase

**Plan errors** (nothing created yet — safe to fix and retry):
- Invalid HCL syntax (LLM generation bug)
- Invalid resource config (bad instance type, unsupported region)
- Provider auth failure (wrong credentials)
- State lock held by another run

**Apply errors** (infrastructure may be partially created):
- API quota/rate limits
- Insufficient IAM permissions
- Resource already exists (state drift)
- Dependency failure (resource A failed so B can't proceed)
- Timeout

#### Recovery flow

```
Chat → Diagram/Config update → [stale banner] → Regenerate → Deploy
  ↑                                                               |
  └──────────── "Chat to fix" ←── plan/apply error ──────────────┘
```

- **Plan error:** block apply, show error inline in Deploy tab, offer "Chat to fix" which focuses the chat input with the error pre-filled
- **Apply error:** set status `deploy_failed`, stream the full output, show which resources failed, offer retry (re-running apply is safe — Terraform only creates what's missing) and "Chat to fix"
- **Post-deploy chat changes:** any Mermaid or Config change after a successful deploy sets `iac_stale = true`; plan/apply are disabled in the Deploy tab until code is regenerated
- **Never auto-destroy:** `terraform destroy` is never run automatically on failure

The chat panel is always visible and never disabled by deploy status. Users can chat-to-fix directly from the Deploy tab without switching screens.

### Database

Four main tables (see `prisma/schema.prisma`):

- **sessions** — Mermaid code, Config YAML, generated IaC, status, model choice
- **messages** — chat history per session (user + assistant messages, cascading delete)
- **credential_profiles** — cloud provider credentials (encrypted via Supabase Vault)
- **user_api_keys** — LLM API keys (Anthropic) encrypted via Supabase Vault

User accounts are managed by Supabase Auth (not in Prisma).

After pushing the schema with `prisma db push`, run `supabase/rls.sql` in the Supabase Dashboard SQL editor to enable Row-Level Security on all tables.

---

## Project structure

```
conjure/
├── Dockerfile.dev                     # Dev container (Node 20)
├── docker-compose.yml                 # Docker Compose config
├── .env.example                       # Environment variable template
├── package.json
├── tsconfig.json                      # TypeScript (strict mode)
├── prisma/
│   └── schema.prisma                  # Database models
├── prisma.config.ts                   # Prisma 7 datasource config
├── app/                               # Next.js App Router
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Landing page
│   ├── not-found.tsx                  # Global 404 page
│   ├── globals.css                    # Tailwind + global styles
│   ├── (auth)/                        # Auth pages
│   │   ├── layout.tsx                 # Split-screen layout (branding left, form right)
│   │   ├── login/page.tsx             # Login (implemented)
│   │   ├── register/page.tsx          # Register (implemented)
│   │   ├── forgot-password/page.tsx   # Forgot password (implemented)
│   │   └── reset-password/page.tsx    # Reset password (implemented)
│   ├── (app)/                         # Authenticated pages
│   │   ├── layout.tsx                 # Sidebar shell
│   │   ├── home/page.tsx              # Home / dashboard (implemented)
│   │   ├── session/
│   │   │   ├── new/page.tsx           # Session setup (implemented)
│   │   │   └── [id]/page.tsx          # Main session view (implemented)
│   │   └── settings/
│   │       ├── layout.tsx             # Settings sub-navigation
│   │       ├── api-keys/              # LLM API key management (implemented)
│   │       ├── credentials/           # Cloud credential management
│   │       └── github/                # GitHub OAuth connection
│   └── api/
│       ├── api-keys/                  # LLM API key CRUD (implemented)
│       ├── auth/
│       │   ├── callback/              # OAuth callback handler (implemented)
│       │   └── github/                # GitHub OAuth initiation (implemented)
│       ├── chat/                      # Streaming chat with LLM (implemented)
│       ├── models/                    # Available model list (implemented)
│       ├── sessions/                  # Session list (implemented)
│       │   └── [id]/                  # Session detail (implemented)
│       ├── classify/                  # Prompt → topology / config / question
│       ├── generate/
│       │   ├── diagram/               # Call 1: prompt → Mermaid + Config
│       │   └── code/                  # Call 2: Mermaid + Config → IaC (HCL)
│       ├── deploy/
│       │   ├── plan/                  # terraform plan
│       │   └── apply/                 # terraform apply
│       └── credentials/               # Credential profile management
├── components/
│   ├── auth/                          # Auth components (AuthBrandingPanel, OAuthButtons, SignOutButton)
│   ├── settings/                      # Settings components (ApiKeyCard)
│   ├── sidebar/                       # Sidebar with session list (implemented)
│   ├── session/
│   │   ├── SessionView.tsx            # Main session layout (implemented)
│   │   ├── ChatPanel.tsx              # Chat messages display (implemented)
│   │   ├── ChatInput.tsx              # Chat input with guardrails (implemented)
│   │   ├── DiagramPanel.tsx           # Mermaid diagram rendering (implemented)
│   │   ├── PropertiesDrawer/          # Click node → edit config
│   │   ├── CodePanel/                 # Generated IaC viewer
│   │   └── DeployPanel/               # Deploy config + plan/apply
│   └── ui/                            # Shared primitives (ConjureLogo)
├── lib/
│   ├── prisma.ts                      # Prisma client singleton
│   ├── llm/
│   │   ├── client.ts                  # LLM SDK routing (OpenRouter / Anthropic) (implemented)
│   │   ├── guardrails.ts              # Input pre-filter (implemented)
│   │   ├── parse.ts                   # LLM output parser (implemented)
│   │   ├── types.ts                   # LLM type definitions (implemented)
│   │   └── prompts/
│   │       └── diagram.ts             # Diagram generation prompt (implemented)
│   ├── supabase/
│   │   ├── auth.ts                    # Shared getAuthenticatedUserId helper (implemented)
│   │   ├── client.ts                  # Browser Supabase client
│   │   ├── server.ts                  # Server Supabase client
│   │   └── middleware.ts              # Auth middleware helper
│   ├── config/
│   │   ├── validate.ts                # Config YAML validation (implemented)
│   │   └── sync.ts                    # Mermaid ↔ Config node ID sync (implemented)
│   ├── mermaid/
│   │   └── validate.ts                # Mermaid syntax validation (implemented)
│   ├── rate-limit.ts                  # In-memory sliding window rate limiter (implemented)
│   ├── sessions/
│   │   └── validation.ts              # Session input validation (implemented)
│   ├── utils/
│   │   └── date-groups.ts             # Date grouping + relative time (implemented)
│   ├── icons/                         # SVG icon registry for diagram nodes
│   ├── terraform/                     # Plan/apply execution, HCL validation
│   └── vault/
│       └── api-keys.ts                # LLM API key Vault helpers (implemented)
├── terraform-templates/               # Base IaC templates
│   ├── aws/
│   └── gcp/
├── tests/
│   ├── llm/                           # LLM output parsing tests
│   ├── config/                        # YAML ↔ Mermaid sync tests
│   ├── mermaid/
│   └── terraform/
└── docs/
    ├── DEVELOPMENT.md                 # This file
    └── conjure-mockup-v3.html         # UI mockup (open in browser)
```

Files marked `(implemented)` are functional. Remaining directories are scaffolded for future work.

---

## UI reference

The approved UI mockup is at `docs/conjure-mockup-v3.html`. Open it in a browser to see all 13 screens:

1. Login
2. Register
3. Home (empty state)
4. Settings (credentials, GitHub, preferences)
5. New session (GitHub connected)
6. New session (no GitHub)
7. Diagram view
8. Properties drawer
9. Confirm + warning states
10. Code tab (stale banner)
11. Deploy tab
12. Split view (diagram + code)
13. Existing repo import

The mockup defines **layout and structure**. Aesthetics may be refined per-screen during implementation.

**Design tokens from the mockup:**

| Token | Value |
|---|---|
| Heading font | Plus Jakarta Sans |
| Body font | Inter |
| Mono font | JetBrains Mono |
| Background | `#F7F6F3` |
| Surface | `#FFFFFF` |
| Text | `#1A1A18` |
| Muted | `#6B6A65` |
| Border radius | 8px (default), 12px (large) |

---

## Conventions

### TypeScript

- **Strict mode** — `strict: true` + `noUncheckedIndexedAccess: true`
- No `any`, no `as unknown as`, no suppressed errors
- Server components by default — use `'use client'` only when needed (event handlers, browser APIs, Mermaid rendering)

### Naming

- `camelCase` for variables and functions
- `PascalCase` for types, interfaces, and components
- `SCREAMING_SNAKE_CASE` for constants
- Booleans read as statements: `isDeploying`, `hasCredentials`, `canProceed`
- Descriptive names: `generateDiagramFromPrompt` over `genDiag`

### Functions

- Small and single-purpose (~40 lines max)
- Prefer pure functions; isolate side effects at the edges (API routes, DB calls)
- Use early returns to avoid deep nesting

### Comments

- Explain *why*, not *what*
- No commented-out code

### Git

- Feature branches → PR to `main`
- Concise commit messages — one short line
- Good: `add credential selector to deploy tab`
- Bad: multi-paragraph messages, `Co-authored-by` lines

### Testing priorities

1. LLM output parsing (Mermaid validation, Config YAML validation)
2. Mermaid ↔ Config node ID sync
3. Prompt classifier (topology vs config vs question)
4. Supabase Vault read/write for credentials
