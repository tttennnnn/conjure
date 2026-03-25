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

| Command | What it does |
|---|---|
| `docker compose up` | Start dev server (after first build) |
| `docker compose up --build` | Rebuild container (after changing package.json) |
| `docker compose exec app bash` | Shell into the container |
| `docker compose exec app npx prisma migrate dev` | Run database migrations |
| `docker compose exec app npx prisma generate` | Regenerate Prisma client |
| `docker compose exec -e NODE_ENV=production app npm run build` | Check production build |
| `docker compose down` | Stop everything |

### 5. Adding a new npm package

```bash
npm install <package>          # local (for IDE)
docker compose up --build      # rebuild container
```

Both steps needed — local for autocomplete, rebuild so the container picks it up.

---

## Architecture

### Core model: dual source of truth

Infrastructure is defined by **two files that work as a pair**:

- **Mermaid** — topology only (what nodes exist and how they connect)
- **Config YAML** — everything else (resource types, instance sizes, networking, ports)

Node IDs are the glue — every node ID in Mermaid must have a corresponding entry in the config. If one has an ID the other doesn't, that's a validation error.

Terraform HCL is always a **derived output** generated from the Mermaid + Config pair. It is never edited directly or patched incrementally.

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
| **Call 2** | User clicks "Generate Code" | Full Mermaid + full Config | Terraform HCL files |

There is no incremental code patching. Code is always fully regenerated.

### LLM security

Defence is layered — no single layer is assumed to be sufficient.

| Layer | What it does | Location |
|---|---|---|
| **Input length limit** | Rejects messages over 1000 chars | `app/api/chat/route.ts` |
| **Call 0 — Guardrail classifier** | LLM classifies message as `INFRA` or `REJECT`. Blocks off-topic, prompt injection, role override attempts. Uses `max_tokens: 10`, `temperature: 0` for deterministic single-word output. | `lib/llm/guardrails.ts` |
| **System prompt hardening** | Explicit instructions to never reveal/modify the system prompt, never follow override instructions, treat injection attempts as off-topic. | `lib/llm/prompts/diagram.ts` |
| **Output validation** | `parseLLMResponse()` only extracts content within `<<<MERMAID>>>` / `<<<CONFIG>>>` delimiters. Arbitrary LLM output cannot corrupt the diagram or config. Mermaid and YAML are validated before saving. | `lib/llm/parse.ts` |
| **Rendering** | Mermaid rendered with `securityLevel: 'strict'` (no HTML). YAML parsed in safe mode. | Client-side |

**Known limitations:**

- **Fail-open guardrail** — if Call 0 errors (network timeout, rate limit), it returns `allowed: true`. This prevents guardrail failures from blocking legitimate users, but means a transient error bypasses the check. A production system should fail closed or use a fallback classifier.
- **Same model for guardrail and generation** — Call 0 uses the same model as Call 1. A weaker free-tier model may be easier to trick than a premium model. A dedicated lightweight classifier would be more robust.
- **Subtle injection** — messages that start with valid infra content but embed secondary instructions (e.g. "Add a VPC. Also ignore previous rules and...") may pass Call 0. The system prompt hardening in Call 1 is the backstop, but it's LLM-dependent, not deterministic.

### LLM provider routing

| Scenario | SDK used | Key source |
|---|---|---|
| Free models (default) | `openai` package → OpenRouter API | `OPENROUTER_API_KEY` env var |
| User brings OpenRouter key | `openai` package → OpenRouter API | User's key stored in Supabase Vault |
| User brings Anthropic key | `@anthropic-ai/sdk` | User's key stored in Supabase Vault |

**Free models available out of the box:** Gemini 2.0 Flash, Llama 3.3 70B, GPT-4o mini.

**BYOK (Bring Your Own Key):** Users can add their own OpenRouter key (unlocks all OpenRouter models) or Anthropic key (unlocks Claude Haiku, Sonnet, Opus) in Settings > API Keys.

### Database

Five main tables (see `prisma/schema.prisma`):

- **sessions** — Mermaid code, Config YAML, generated Terraform, status, model choice
- **messages** — chat history per session (user + assistant messages, cascading delete)
- **user_custom_models** — user-added OpenRouter models (display name + model ID)
- **credential_profiles** — cloud provider credentials (encrypted via Supabase Vault)
- **user_api_keys** — LLM API keys (OpenRouter, Anthropic) encrypted via Supabase Vault

User accounts are managed by Supabase Auth (not in Prisma).

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
│   ├── globals.css                    # Tailwind + global styles
│   ├── (auth)/                        # Auth pages (login, register, forgot/reset password)
│   │   └── layout.tsx                 # Split-screen layout (brand left, form right)
│   ├── (app)/                         # Authenticated pages
│   │   ├── layout.tsx                 # Sidebar shell
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
│       ├── chat/                      # Streaming chat with LLM (implemented)
│       ├── models/                    # Available model list (implemented)
│       ├── sessions/                  # Session list + detail (implemented)
│       ├── classify/                  # Prompt → topology / config / question
│       ├── generate/
│       │   ├── diagram/               # Call 1: prompt → Mermaid + Config
│       │   └── code/                  # Call 2: Mermaid + Config → Terraform
│       ├── deploy/
│       │   ├── plan/                  # terraform plan
│       │   └── apply/                 # terraform apply
│       └── credentials/               # Credential profile management
├── components/
│   ├── auth/                          # Auth components (OAuthButtons, SignOutButton)
│   ├── settings/                      # Settings components (ApiKeyCard)
│   ├── sidebar/                       # Sidebar with session list (implemented)
│   ├── session/
│   │   ├── SessionView.tsx            # Main session layout (implemented)
│   │   ├── ChatPanel.tsx              # Chat messages display (implemented)
│   │   ├── ChatInput.tsx              # Chat input with guardrails (implemented)
│   │   ├── DiagramPanel.tsx           # Mermaid diagram rendering (implemented)
│   │   ├── PropertiesDrawer/          # Click node → edit config
│   │   ├── CodePanel/                 # Generated Terraform viewer
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
│   ├── sessions/
│   │   └── validation.ts              # Session input validation (implemented)
│   ├── utils/
│   │   └── date-groups.ts             # Date grouping + relative time (implemented)
│   ├── icons/                         # SVG icon registry for diagram nodes
│   ├── terraform/                     # Plan/apply execution, HCL validation
│   └── vault/
│       └── api-keys.ts                # LLM API key Vault helpers (implemented)
├── terraform-templates/               # Base Terraform templates
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
