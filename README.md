# Xcluice MCP Server

A private MCP (Model Context Protocol) server that lets Claude read and
write data in the Xcluice/Fosthub Supabase backend ("We learn" project) —
homework entries and chat messages.

## What it exposes

| Tool | What it does |
|---|---|
| `list_homework` | List homework/assignment entries, most recent first |
| `create_homework` | Add a new homework/assignment entry |
| `update_homework` | Edit an existing entry by id |
| `list_chat_messages` | List recent chat messages (filter by uid/to_uid) |
| `post_chat_message` | Send a new chat message |
| `list_chat_users` | List chat users |
| `list_team_members` | List Fosthub team members (never returns password hashes) |

## 1. Get your Supabase service role key

This server uses the **service role key** (not the anon key), since it
needs to bypass Row Level Security to read/write freely.

1. Go to your Supabase dashboard → the "We learn" project
   (`nzolsmouyulzqeaocejm`)
2. Project Settings → API → copy the **service_role** secret key
3. Keep this secret — it has full access to your database

## 2. Generate an MCP secret

Claude's custom connector UI only supports OAuth or a fully open server on
personal (non-Team) plans. Since this is for one user, we put a secret in
the URL path instead — it acts like a password.

```bash
openssl rand -hex 32
```

Save this value — you'll need it twice (as an env var, and in the
connector URL).

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo (a new one, e.g. `xcluice-mcp` — keep
   it separate from your main `Xcluice` repo)
2. Go to https://vercel.com/new and import that repo
3. Before deploying, add these Environment Variables:
   - `SUPABASE_URL` = `https://nzolsmouyulzqeaocejm.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = *(the key from step 1)*
   - `MCP_SECRET` = *(the value from step 2)*
4. Deploy

Your MCP endpoint will be:

```
https://<your-vercel-app>.vercel.app/<MCP_SECRET>/mcp
```

## 4. Add it as a custom connector in Claude

1. Claude settings → Connectors → Add custom connector
2. Paste the full URL above (with your real secret in it)
3. Leave OAuth Client ID/Secret blank — this server has its own auth via
   the secret path, so pick "No Authentication" if asked
4. Connect

If it connects, Claude will show the 7 tools listed above.

## Notes on the auth approach

This isn't OAuth — anyone with the exact URL (including the secret) has
full read/write access to homework and chat data. Treat that URL like a
password:

- Don't share it, post it publicly, or commit it to a public repo
- If it ever leaks, regenerate `MCP_SECRET` in Vercel's env vars and update
  the connector URL in Claude
- `fosthub_users.password_hash` is never returned by any tool, regardless
  of this secret — that's hardcoded, not configurable

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Test with curl:

```bash
curl -X POST http://localhost:3000/<MCP_SECRET>/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
