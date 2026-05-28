# Google Workspace MCP Server

## Project Overview

Node.js MCP server that exposes the **full Google Workspace API surface** to MCP clients (Claude Code, Claude Desktop). One OAuth2 login grants access to seven Google services through a single set of tools.

**76 tools across 7 services:** Sheets (26), Drive (12), Apps Script (12), Calendar (7), Gmail (7), Docs (6), Slides (6).

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

## Commands

```bash
npm run auth    # one-time OAuth2 browser login
npm start       # start the MCP server (stdio transport)
```

## Connecting to Claude Code

```bash
claude mcp add google-workspace -- node C:\google_workspace_MCP\src\index.js
```

## Key Conventions

- Sheets API uses **A1 notation** for ranges (e.g. `'Sheet1'!A1:C10`); structural ops use **0-based grid indices, end-exclusive**.
- `gas_update_content` is a **FULL REPLACEMENT** of project files — always `gas_get_content` first.
- `gas_run_script` requires the script to be deployed as an **API executable**.
- Calendar: all-day events use `YYYY-MM-DD`; timed events use full ISO datetime (e.g. `2026-06-01T09:00:00+08:00`). `calendar.js` picks `date` vs `dateTime` by string length.
- Gmail send builds a base64url-encoded RFC 2822 message in `gmail.js` (`buildRawMessage`).
- Drive has both `drive_trash_file` (reversible) and `drive_delete_file` (permanent). Prefer trash.
- Docs/Slides `*_batch_update` tools accept raw API request arrays for advanced edits beyond the convenience methods.
