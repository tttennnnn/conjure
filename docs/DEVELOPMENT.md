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

### Two LLM calls

| Call | Trigger | Input | Output |
|---|---|---|---|
| **Call 1** | User sends a topology or config message | Prompt + current Mermaid + Config | Updated Mermaid and/or Config + chat explanation |
| **Call 2** | User clicks "Generate Code" | Full Mermaid + full Config | Terraform HCL files |

There is no incremental code patching. Code is always fully regenerated.

### LLM provider routing

| Scenario | SDK used | Key source |
|---|---|---|
| Free models (default) | `openai` package → OpenRouter API | `OPENROUTER_API_KEY` env var |
| User brings OpenRouter key | `openai` package → OpenRouter API | User's key stored in Supabase Vault |
| User brings Anthropic key | `@anthropic-ai/sdk` | User's key stored in Supabase Vault |

**Free models available out of the box:** Gemini 2.0 Flash, Llama 3.3 70B, GPT-4o mini.

**BYOK (Bring Your Own Key):** Users can add their own OpenRouter key (unlocks all OpenRouter models) or Anthropic key (unlocks Claude Sonnet, Claude Opus) in Settings > API Keys.

### Database

Three main tables (see `prisma/schema.prisma`):

- **sessions** — Mermaid code, Config YAML, generated Terraform, status, model choice
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
│   ├── (auth)/                        # Auth pages (login, register)
│   │   └── layout.tsx                 # Split-screen layout (brand left, form right)
│   ├── (app)/                         # Authenticated pages
│   │   ├── layout.tsx                 # Sidebar shell
│   │   ├── session/
│   │   │   ├── new/                   # Session setup
│   │   │   └── [id]/                  # Main session view (chat + diagram)
│   │   └── settings/
│   │       ├── layout.tsx             # Settings sub-navigation
│   │       ├── api-keys/             # LLM API key management (implemented)
│   │       ├── credentials/           # Cloud credential management
│   │       └── github/                # GitHub OAuth connection
│   └── api/
│       ├── api-keys/                  # LLM API key CRUD (implemented)
│       ├── sessions/                  # Session CRUD
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
│   ├── session/
│   │   ├── ChatPanel/                 # Chat messages + input
│   │   ├── DiagramPanel/              # Mermaid diagram rendering
│   │   ├── PropertiesDrawer/          # Click node → edit config
│   │   ├── CodePanel/                 # Generated Terraform viewer
│   │   └── DeployPanel/               # Deploy config + plan/apply
│   └── ui/                            # Shared primitives
├── lib/
│   ├── prisma.ts                      # Prisma client singleton
│   ├── llm/
│   │   └── prompts/                   # Versioned prompt templates
│   ├── supabase/
│   │   ├── client.ts                  # Browser Supabase client
│   │   ├── server.ts                  # Server Supabase client
│   │   └── middleware.ts              # Auth middleware helper
│   ├── config/                        # YAML parsing, validation, node ID sync
│   ├── mermaid/                       # Mermaid validation helpers
│   ├── icons/                         # SVG icon registry for diagram nodes
│   ├── terraform/                     # Plan/apply execution, HCL validation
│   └── vault/
│       └── api-keys.ts               # LLM API key Vault helpers (implemented)
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

Most directories are scaffolded but empty — implementation starts from here.

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
