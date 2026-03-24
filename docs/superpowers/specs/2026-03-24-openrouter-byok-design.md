# OpenRouter BYOK (Bring Your Own Key)

Allow users to provide their own OpenRouter API key to unlock all models available on their OpenRouter account, replacing the app-provided key for their sessions.

---

## Data Model

New Prisma model `UserApiKey` (table `user_api_keys`):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, default `uuid()` |
| `user_id` | UUID | References Supabase `auth.users`. |
| `provider` | String | `"openrouter"` or `"anthropic"` |
| `encrypted_key` | String | Encrypted via Supabase Vault |
| `created_at` | DateTime | Default `now()` |
| `updated_at` | DateTime | `@updatedAt` |

**Constraints:**
- Unique on `(user_id, provider)` — one key per provider per user
- RLS: users can only read/write their own rows

This table is separate from `CredentialProfile` (cloud provider credentials). LLM keys have no region, no named profiles — just one key per provider.

---

## Vault Integration

New helpers in `lib/vault/api-keys.ts`:

- `storeApiKey(userId: string, provider: string, key: string): Promise<void>` — encrypt key via Supabase Vault, upsert into `user_api_keys`
- `getApiKey(userId: string, provider: string): Promise<string | null>` — decrypt and return key, or null if not set
- `deleteApiKey(userId: string, provider: string): Promise<void>` — remove key and Vault secret

Encryption uses Supabase Vault's `vault.create_secret()` / `vault.update_secret()` Postgres functions via the service role client. The `encrypted_key` column stores the Vault secret ID (UUID), not the raw key.

---

## API Routes

### `GET /api/api-keys`

Returns the user's stored keys with masked values.

**Response:**
```json
[
  { "provider": "openrouter", "key_hint": "sk-or-...7x2f", "created_at": "..." },
  { "provider": "anthropic", "key_hint": "sk-ant-...9k3m", "created_at": "..." }
]
```

`key_hint` shows first 6 + last 4 characters. If no key exists for a provider, it is omitted from the array.

### `POST /api/api-keys`

Store or replace a key.

**Request body:**
```json
{ "provider": "openrouter", "key": "sk-or-v1-..." }
```

**Validation:**
- `provider` must be `"openrouter"` or `"anthropic"`
- `key` must be a non-empty string, minimum 16 characters
- Format check: OpenRouter keys must start with `sk-or-`, Anthropic keys must start with `sk-ant-`
- Server-side auth via `supabase.auth.getUser()`

**Response:** `200 OK` with `{ "provider": "openrouter", "key_hint": "sk-or-...7x2f" }`

### `DELETE /api/api-keys?provider=openrouter`

Remove a key. Provider specified as a query parameter.

**Response:** `200 OK` with `{ "deleted": true }`

---

## SDK Routing

Current routing (from CLAUDE.md):

| Scenario | SDK | Key source |
|---|---|---|
| Free models | `openai` SDK → OpenRouter | `OPENROUTER_API_KEY` env var |
| User's Anthropic key | `@anthropic-ai/sdk` | User's key from Vault |

Updated routing:

| Scenario | SDK | Key source |
|---|---|---|
| No user OpenRouter key | `openai` SDK → OpenRouter | `OPENROUTER_API_KEY` env var |
| User has OpenRouter key | `openai` SDK → OpenRouter | User's key from Vault |
| User has Anthropic key | `@anthropic-ai/sdk` | User's key from Vault |

When the user provides their own OpenRouter key, it replaces the app key entirely. The user gets access to all models their OpenRouter account supports.

---

## Model Selection

Session setup model picker behavior:

1. Fetch user's stored API keys (which providers they have keys for)
2. Build available model list:
   - **No OpenRouter key:** show 3 free models (Gemini 2.0 Flash, Llama 3.3 70B, GPT-4o mini)
   - **Has OpenRouter key:** fetch available models from OpenRouter API (`GET https://openrouter.ai/api/v1/models` with user's key), show all
   - **Has Anthropic key:** add Claude Sonnet, Claude Opus to the list
3. Display models grouped by provider with tier badges (Free / Premium)

For the initial implementation, the "has OpenRouter key" case can show a curated expanded list rather than fetching dynamically from the API — this avoids slow model list fetches and keeps the UX snappy. Dynamic model fetching can be added later. The specific curated model list is an implementation-time decision based on what's popular/useful on OpenRouter at that point.

---

## UI: Settings > API Keys

New route: `app/(app)/settings/api-keys/page.tsx`

### Layout

Two cards (stacked on mobile, side by side on desktop):

**OpenRouter card:**
- Provider name + logo/icon
- Description: "Provide your own key to unlock all OpenRouter models"
- If no key: text input + "Save" button
- If key saved: masked key display (e.g. `sk-or-...7x2f`) + "Replace" and "Remove" buttons
- Status badge: "Connected" (green) or "Not connected" (neutral)

**Anthropic card:**
- Same pattern as OpenRouter
- Description: "Provide your key to unlock Claude Sonnet and Claude Opus"

### Navigation

Settings page accessible from sidebar. The settings section should have sub-navigation:
- API Keys (this page)
- Credentials (cloud provider creds — future)
- GitHub (OAuth connection — future)

### Validation

- Client-side: non-empty string check before submit
- Server-side: format validation (OpenRouter keys start with `sk-or-`, Anthropic keys start with `sk-ant-`)
- No live key validation (calling the provider API to check) in v1 — kept simple

---

## Security

- Keys encrypted at rest via Supabase Vault — never stored in plaintext
- Keys decrypted only server-side at the moment of LLM API calls
- RLS on `user_api_keys` — users can only access their own rows
- API routes validate auth via `supabase.auth.getUser()` — never trust client-sent user ID
- Key hints (masked display) generated server-side — full key never sent to the client after storage
- No keys in URL params, query strings, or client-side storage (localStorage/sessionStorage)
- Rate limiting on `/api/api-keys` endpoints — prevent brute-force key storage/deletion

---

## Error Handling

### Invalid/revoked keys at LLM call time

Keys are not validated against the provider API on save (v1). If a stored key is invalid or revoked, the LLM call will fail. When this happens:
- The API route returns an error indicating the key is invalid
- The chat UI shows an error message: "Your [provider] API key is invalid or revoked. Update it in Settings > API Keys."
- The error includes a link to the API Keys settings page

### Key deletion with active sessions

If a user deletes their OpenRouter key while sessions exist that use models requiring that key:
- Existing sessions remain in the sidebar with their current state
- New LLM calls in those sessions fail gracefully with: "Your OpenRouter API key is no longer configured. Add one in Settings, or start a new session with a free model."
- No blocking — users can always delete their keys

### Key rotation (replace)

Replacing a key is an atomic upsert. In-flight LLM calls that already read the old key from Vault will complete with the old key. Subsequent calls use the new key. No special handling needed.

---

## CLAUDE.md Updates Required

This feature expands the BYOK model beyond what CLAUDE.md currently describes (Anthropic-only). The following CLAUDE.md sections need updating after implementation:

1. **LLM provider routing table** — add "User has OpenRouter key" row showing user's key from Vault
2. **Provider strategy section** — change "BYOK: Users can add their own Anthropic API key" to include OpenRouter
3. **Available models table** — add note that users with their own OpenRouter key get access to all OpenRouter models
4. **SDK routing table** — add OpenRouter BYOK row
5. **Tech stack table** — update "LLM BYOK | Anthropic" to "LLM BYOK | Anthropic + OpenRouter"
6. **Credential handling bullet** — expand to mention OpenRouter keys alongside Anthropic

---

## Files to Create/Modify

### New files
- `app/(app)/settings/api-keys/page.tsx` — Settings API Keys page
- `app/api/api-keys/route.ts` — API key CRUD endpoint
- `lib/vault/api-keys.ts` — Vault encrypt/decrypt helpers for API keys
- `components/settings/ApiKeyCard.tsx` — Reusable card component for each provider

### Modified files
- `prisma/schema.prisma` — Add `UserApiKey` model
- `app/(app)/layout.tsx` — Add settings navigation link in sidebar
- `app/(app)/settings/layout.tsx` — Settings sub-navigation layout (new file, but within existing directory)

### Not modified (yet)
- LLM routing logic (`lib/llm/`) — scaffolded but empty; will be built when LLM integration is implemented. The routing table above defines the contract.
- Session setup model picker — not yet built; will consume the API keys API when implemented.
