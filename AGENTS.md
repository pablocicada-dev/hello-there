<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## DeltaGate-IoT project rules

- Gate rules live in `src/lib/engine.ts` as pure functions shared by server, UI and tests (`src/lib/engine.test.ts`); change rules there, never inline in pages. Why: one source of truth for safety logic.
- All database writes go through server functions (`src/lib/*.functions.ts`) or `/api/public/*` device routes using the service-role client; the browser only reads (anon SELECT policies) and subscribes to realtime. Why: no login yet, so the browser must not write directly.
- ESP32 endpoints (`/api/public/ingest-reading`, `/pending-command`, `/ack-command`) check the `x-api-key` header against the `DEVICE_API_KEY` secret. Why: these URLs are public.
- Every satellite source fetcher lives in `src/lib/sources/<source>.server.ts` and returns `SourceSyncResult`; `sync.server.ts` stores results in `data_sources`. Why: swapping mocks for real NASA Earthdata calls stays local to one file.
- The simulator and the fail-safe heartbeat run from the `tick` server function, called every 10 s by open app tabs (deduplicated server-side). Why: the server runtime has no background timers.
- Charts read bucketed data from the `readings_bucketed` / `rain_bucketed` SQL functions. Why: avoids the 1000-row API limit at 30-day ranges.
