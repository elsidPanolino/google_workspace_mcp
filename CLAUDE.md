# Google Workspace MCP Server

## Project Overview

Node.js MCP server that exposes the **full Google Workspace API surface** to MCP clients (Claude Code, Claude Desktop). One OAuth2 login grants access to seven Google services through a single set of tools.

**76 tools across 7 services:** Sheets (26), Drive (12), Apps Script (12), Calendar (7), Gmail (7), Docs (6), Slides (6).

## Safety Rules (MANDATORY — these tools touch live company data)

- **Gmail — never send without confirmation.** Do not call `gmail_send` unless the user has explicitly confirmed the recipient, subject, and body in this session. Prefer `gmail_create_draft` so a human reviews before sending.
- **No permanent deletes.** Use `drive_trash_file` (reversible), never `drive_delete_file`, unless the user explicitly asks for permanent deletion. Confirm before `sheets_delete_tab`, `sheets_delete_rows_columns`, `sheets_clear`, or `calendar_delete_event`.
- **Apps Script writes are destructive.** `gas_update_content` FULLY REPLACES all project files. Always `gas_get_content` first and save the previous content locally before writing.
- **Sharing exposes data externally.** Before `drive_share` or `sheets_share`, confirm the recipient and role. Default to `reader` unless told otherwise.

## Structure

```
src/
  index.js              # MCP entry point: boots server, constructs clients, registers all tools
  auth.js               # OAuth2 flow with token persistence; defines the full scope list
  clients/              # one Google API wrapper class per service
    sheets.js           #   SheetsClient   — google.sheets v4 (+ drive for folder moves)
    drive.js            #   DriveClient    — google.drive v3
    apps-script.js      #   AppsScriptClient — google.script v1 (+ drive for listing)
    calendar.js         #   CalendarClient — google.calendar v3
    gmail.js            #   GmailClient    — google.gmail v1
    docs.js             #   DocsClient     — google.docs v1
    slides.js           #   SlidesClient   — google.slides v1
  tools/                # one tool-registration module per service
    sheets.tools.js     #   exports registerSheetsTools(server, client, handler)
    drive.tools.js
    apps-script.tools.js
    calendar.tools.js
    gmail.tools.js
    docs.tools.js
    slides.tools.js

tokens/                 # persisted OAuth tokens (gitignored)
.env                    # Google OAuth credentials (gitignored)
.env.example            # credential template
scripts/                # OPTIONAL local automation, machine-specific (gitignored — do not reference in shared docs)
```

## Architecture

- **One OAuth client, all scopes.** `auth.js` requests every Workspace scope up front. The same authenticated `auth` object is handed to all seven client classes in `index.js`.
- **Clients are thin API wrappers.** Each `clients/*.js` class takes `auth` in its constructor, builds its `google.<service>(...)` handle, and exposes plain async methods that return `res.data`.
- **Tools are registered per service.** Each `tools/*.tools.js` exports a `register…Tools(server, client, handler)` function that defines `server.tool(name, description, zodSchema, handler(...))` blocks. `index.js` calls all seven.
- **`handler(fn)`** (defined in `index.js`) wraps every tool: serializes the result to JSON text, and on error returns `{ isError: true }` with the Google API error message.

## Adding a new Google API

1. `clients/<name>.js` — a class taking `auth`, building `google.<name>({version, auth})`, with async methods.
2. `tools/<name>.tools.js` — `export function register<Name>Tools(server, client, handler) { server.tool(...) }`.
3. `index.js` — import the client + register function, add the client to the `clients` object, and call the register function.
4. `auth.js` — add any new OAuth scope(s) to `SCOPES`, then **re-run `npm run auth`** (existing tokens won't cover new scopes).

## OAuth scopes (auth.js)

```
script.projects   script.deployments   script.processes
drive   spreadsheets
calendar
gmail.modify   gmail.send
documents   presentations
```

Gmail's `gmail.modify` and `gmail.send` are **restricted scopes** — for unverified apps Google shows an "unverified app" warning on the consent screen. Click through as the test user (add yourself under OAuth consent screen → Test users). Trim scopes here if you don't register a given service's tools.

## Setup

1. **Google Cloud Console** — enable these APIs in your project: Google Sheets, Drive, Apps Script, Calendar, Gmail, Docs, Slides. Create an **OAuth client ID → Web application**, add redirect URI `http://localhost:3000/oauth2callback`.
2. **`.env`** — copy `.env.example`, fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. **`npm install`**
4. **`npm run auth`** — one-time browser consent; tokens persist to `tokens/google-tokens.json` and auto-refresh.

Setup is **per machine and per Google account**: every user who clones this repo creates their own `.env` (or reuses the team's shared OAuth client ID/secret) and runs `npm run auth` with their own Google account. `.env` and `tokens/` are gitignored and must never be committed.

## Staying Updated

At the start of a session where this server's tools will be used (or when the user asks "is this up to date?"):

1. Run `git fetch` in the repo, then compare `git rev-list HEAD..origin/main --count`.
2. If the local copy is behind, tell the user what's new (`git log HEAD..origin/main --oneline`) and **ask if they want to update**. Do not pull without approval.
3. If approved: `git pull`, then `npm install`. If `SCOPES` in `src/auth.js` changed, tell the user to re-run `npm run auth`. Never pull over local modifications — if `git status` shows changes, surface them first.
4. If git isn't available or the folder isn't a git clone: guide the user to download the ZIP from https://github.com/elsidPanolino/google_workspace_mcp (Code → Download ZIP) and replace the repo files — **preserving** `.env`, `tokens/`, and any `CLAUDE.local.md` — then run `npm install`.
5. Either way, remind the user that updates take effect in a **new session** — the running MCP server keeps executing the old code.

## Credentials & Token Policy

- **Never** commit, print, echo, or paste the contents of `.env` or `tokens/google-tokens.json` into chats, logs, commits, or issues.
- One token = one Google account = one machine. Do not copy token files between people or machines.
- **If a token may be leaked:** revoke access at myaccount.google.com → Security → Third-party access, delete `tokens/`, and re-run `npm run auth`.

## Team Workflow

- Changes to `src/` go through a **pull request to `main`**, not direct pushes.
- Adding a scope to `SCOPES` in `auth.js` needs team sign-off — every added scope widens what a leaked token can do.
- Machine-local automation lives in `scripts/` (gitignored). Never import from `scripts/` inside `src/`.
- When adding or removing tools, keep the tool counts in this file and README.md in sync.
- Shared OAuth client owner / test-user access: ask `<team lead — fill in>`.

## Commands

```bash
npm run auth    # one-time OAuth2 browser login
npm start       # start the MCP server (stdio transport)
```

## Connecting to Claude Code

```bash
claude mcp add google-workspace -- node /absolute/path/to/google_workspace_MCP/src/index.js
```

On Windows, use forward slashes in the path (e.g. `C:/path/to/google_workspace_MCP/src/index.js`) to avoid backslash stripping. Tools become available in a new session.

## Key Conventions

- Sheets API uses **A1 notation** for ranges (e.g. `'Sheet1'!A1:C10`); structural ops use **0-based grid indices, end-exclusive**.
- `gas_update_content` is a **FULL REPLACEMENT** of project files — always `gas_get_content` first.
- `gas_run_script` requires the script to be deployed as an **API executable**.
- Calendar: all-day events use `YYYY-MM-DD`; timed events use full ISO datetime (e.g. `2026-06-01T09:00:00+08:00`). `calendar.js` picks `date` vs `dateTime` by string length.
- Gmail send builds a base64url-encoded RFC 2822 message in `gmail.js` (`buildRawMessage`).
- Drive has both `drive_trash_file` (reversible) and `drive_delete_file` (permanent). Prefer trash.
- Docs/Slides `*_batch_update` tools accept raw API request arrays for advanced edits beyond the convenience methods.
