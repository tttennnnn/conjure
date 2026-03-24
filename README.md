# Conjure

> Describe your infrastructure. We generate the diagram, the code, and provision it.

Conjure is a **Prompt-to-Infrastructure** web app. Chat with an AI about your cloud infrastructure — it generates and iterates on an architecture diagram in real time, then converts it to Terraform/OpenTofu HCL you can deploy to AWS or GCP.

---

## How it works

Start a session, describe your infrastructure, and chat freely. Conjure classifies each message and decides what to do:

| What you say | What happens |
|---|---|
| "Add a Redis cache" | Diagram + config update, AI explains the change |
| "Set min instances to 3" | Config updated, code marked stale |
| "What instance type should I use?" | AI answers in chat, nothing changes |

Your infrastructure is defined by two files that work as a pair:

- **Mermaid diagram** — topology (what exists and how it connects)
- **Config YAML** — everything else (resource types, instance sizes, ports, networking)

Together they are the source of truth. Terraform/OpenTofu HCL is always derived from them — never edited directly.

When the diagram looks right, click **Generate Code** → choose Terraform or OpenTofu, and HCL appears alongside. Deploy from the browser, or export to your own repo.

---

## Features

- **Conversational infrastructure design** — iterate through chat, not forms
- **Live architecture diagram** — Mermaid-based, updates as you chat
- **Dual source of truth** — Mermaid (topology) + Config YAML (parameters), always in sync
- **Properties drawer** — click any node to see and edit its config inline
- **Multi-provider** — AWS and GCP
- **Free by default** — free LLM models via OpenRouter, no API key needed to start
- **Bring your own key** — add your own OpenRouter or Anthropic API key for premium models
- **Deploy from the browser** — configure credentials, state backend, run plan and apply
- **Export without deploying** — download .zip or open a PR directly
- **Visualize existing infra** — import a GitHub repo and Conjure renders what's already there
- **Split view** — diagram and code side by side
- **Session history** — all sessions saved and resumable

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js (App Router, API routes) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (GitHub OAuth, email/password) |
| Credential storage | Supabase Vault |
| ORM | Prisma |
| Diagrams | Mermaid.js |
| Config format | YAML |
| IaC output | Terraform / OpenTofu |
| LLM (default) | OpenRouter (free models) |
| LLM (BYOK) | Anthropic + OpenRouter |
| Deployment | Vercel |

---

## Getting started

**Prerequisites:** Docker, Node.js 20+

```bash
git clone https://github.com/yourname/conjure.git
cd conjure
npm install                    # local deps (IDE autocomplete)
cp .env.example .env.local     # fill in API keys
docker compose up --build      # start dev server
```

Open [http://localhost:3000](http://localhost:3000).

For detailed setup, architecture, and coding conventions, see the [Development Guide](docs/DEVELOPMENT.md).

---

## Security

Conjure handles cloud credentials and infrastructure operations. Security is built into every layer:

- **Authentication** — Supabase Auth with email/password and GitHub OAuth. All app routes are protected by middleware.
- **Row Level Security** — every database table enforces RLS. Users can only access their own sessions, credentials, and data.
- **Credential encryption** — AWS/GCP keys and user-provided LLM API keys (OpenRouter, Anthropic) are stored via Supabase Vault (encrypted at rest). Decrypted only server-side at the moment of use.
- **Input sanitization** — Mermaid diagrams rendered with `securityLevel: 'strict'`. YAML parsed in safe mode. LLM output treated as untrusted.
- **Server-side validation** — all API routes verify authentication and validate input. Client data is never trusted.
- **No secrets in the browser** — only `NEXT_PUBLIC_*` env vars reach the client. Service keys, database URLs, and credentials are server-only.
- **Rate limiting** — auth, LLM, and deploy endpoints are rate limited to prevent abuse.

---

## Academic context

Built for NTU SC4023 Cloud Computing (2026).

This project explores **topology as a programmable entity** — infrastructure intent is declared through a structured, AI-generated diagram paired with a configuration file, and a generative AI layer produces validated, deployable IaC. A conversational interface makes this loop feel natural rather than mechanical.

---

## Team

| Name | Student ID |
|---|---|
| — | — |
| — | — |

---

## License

MIT
