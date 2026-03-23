# Conjure

> Describe your infrastructure. We generate the diagram, the code, and provision it.

Conjure is a **Prompt-to-Infrastructure** web app. Chat with an AI about your cloud infrastructure — it generates and iterates on an architecture diagram in real time, then converts it to Terraform HCL you can deploy to AWS or GCP.

---

## How it works

Start a session, describe your infrastructure, and chat freely. Conjure figures out what to do with each message:

| What you say | What happens |
|---|---|
| "Add a Redis cache" | Diagram + config update, AI explains the change |
| "Set min instances to 3" | Config updated, code goes stale |
| "What instance type should I use?" | AI answers in chat, nothing changes |

Your infrastructure is defined by two files that work as a pair: a **Mermaid diagram** (topology — what exists and how it connects) and a **Config YAML** (everything else — resource types, instance sizes, ports, networking). Together they are the source of truth. Terraform HCL is always derived from them.

When the diagram and config look right, click **Generate Code** — Terraform HCL appears alongside the diagram. Keep chatting to refine. Deploy when ready, or just export the code to your own repo.

---

## Features

- **Conversational infrastructure design** — iterate on your architecture through chat, not forms
- **Dual source of truth** — Mermaid handles topology, Config YAML handles everything else. They stay in sync automatically.
- **Visualize existing infra** — start from a GitHub repo and Conjure renders what's already deployed
- **Properties drawer** — click any node in the diagram to see and edit its config values inline
- **Pre-defined node icons** — recognized resource types (VMs, databases, Redis) show SVG icons in the diagram; undefined types show text labels only
- **Multi-provider** — AWS and GCP
- **Split view** — see diagram and generated code side by side
- **Deploy from the browser** — configure credentials, state backend, run plan and apply — all in the Deploy tab
- **Export without deploying** — download .zip or open a PR. No credentials needed.
- **Credential management** — store multiple named profiles per cloud provider, encrypted via Supabase Vault. Or use one-off keys.
- **Free by default** — free models via OpenRouter out of the box. Bring your own Anthropic or Google key to unlock premium models.
- **GitHub integration** — open PRs or push generated code directly to your repo
- **Session history** — all sessions saved and resumable at any point

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React, App Router) |
| Backend | Next.js API routes |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (GitHub OAuth + Google OAuth + email/password) |
| Credential encryption | Supabase Vault |
| ORM | Prisma |
| Diagram format | Mermaid.js (client-side) |
| Config format | YAML (paired with Mermaid) |
| IaC | Terraform / OpenTofu |
| LLM (default) | OpenRouter (free models) |
| LLM (BYOK) | Anthropic, Google (user-provided keys) |
| Deployment | Vercel |

---

## Getting started

**Prerequisites:** Docker, Node.js 20+ (for IDE autocomplete)

```bash
# Clone the repo
git clone https://github.com/yourname/conjure.git
cd conjure

# Install dependencies locally (for IDE autocomplete)
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase and OpenRouter API keys

# Start development server (Docker)
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

```bash
# Useful commands
docker compose exec app bash          # shell into the container
docker compose exec app npx prisma migrate dev   # run migrations
docker compose exec app npm run build  # production build check
```

---

## Environment variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM — OpenRouter (required, powers free-tier models)
OPENROUTER_API_KEY=

# Database (Prisma)
DATABASE_URL=
```

User-provided Anthropic/Google keys are stored per-user in Supabase Vault, not in env vars.

---

## Project structure

```
conjure/
├── docs/
│   └── conjure-mockup-v3.html     # Approved UX mockup — source of truth for UI
├── app/                           # Next.js app router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (app)/
│   │   ├── layout.tsx             # Sidebar shell
│   │   ├── session/
│   │   │   ├── new/               # Session setup page
│   │   │   └── [id]/              # Main session view (chat + diagram panel)
│   │   └── settings/              # Credentials, GitHub
│   └── api/
│       ├── classify/              # Classifies prompt: topology / config / question
│       ├── generate/diagram/      # Call 1: prompt → Mermaid + Config YAML
│       ├── generate/code/         # Call 2: Mermaid + Config → Terraform HCL
│       ├── deploy/plan/           # terraform plan execution
│       ├── deploy/apply/          # terraform apply execution
│       └── credentials/
├── components/
│   ├── session/                   # ChatPanel, DiagramPanel, PropertiesDrawer, CodePanel, DeployPanel
│   └── ui/                        # Shared primitives
├── lib/
│   ├── llm/prompts/               # Versioned LLM prompt templates
│   ├── config/                    # Config YAML parsing, validation, node ID sync
│   ├── icons/                     # SVG icon registry (vm.svg, database.svg, redis.svg)
│   ├── mermaid/                   # Mermaid validation
│   ├── terraform/                 # Plan/apply execution, HCL validation
│   ├── vault/                     # Supabase Vault helpers
│   └── supabase/                  # Supabase client setup
├── prisma/schema.prisma
├── terraform-templates/           # Base templates (aws / gcp)
├── tests/
├── CLAUDE.md                      # AI context file for Claude Code
└── .env.example
```

---

## Diagram node icons

Pre-defined SVG icons for recognized resource types. Undefined types render as text-only labels — no icon.

**Currently defined (3):**

| Resource type | Icon |
|---|---|
| VM / Server | Server rack (rectangle with dividers + status dots) |
| Database | Stacked cylinders |
| Redis / Cache | Diamond with crosshair |

Icons are SVG `<symbol>` elements referenced via `<use href>`. The registry maps resource type strings to symbol IDs. New icons can be added to `lib/icons/` as the platform grows.

---

## Academic context

Built for NTU Cloud Computing (2026), Topic 1: Future Data Centers and Diagram-as-Code.

This project explores **topology as a programmable entity** — where infrastructure intent is declared through a structured, AI-generated diagram (Mermaid) paired with a configuration file (YAML), and a generative AI layer interprets that intent to produce validated, deployable IaC. The diagram + config pair is the source of truth that drives provisioning. A conversational interface makes this loop feel natural rather than mechanical.

---

## Team

| Name | Student ID |
|---|---|
| — | — |
| — | — |

---

## License

MIT
