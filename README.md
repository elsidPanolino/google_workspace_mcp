# Google Workspace MCP Server

A Node.js [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the **full Google Workspace API surface** to MCP clients such as Claude Code and Claude Desktop. One OAuth2 login grants access to seven Google services through a single set of tools.

**76 tools across 7 services:**

| Service     | Tools | Underlying API           |
|-------------|-------|--------------------------|
| Sheets      | 26    | `google.sheets` v4       |
| Drive       | 12    | `google.drive` v3        |
| Apps Script | 12    | `google.script` v1       |
| Calendar    | 7     | `google.calendar` v3     |
| Gmail       | 7     | `google.gmail` v1        |
| Docs        | 6     | `google.docs` v1         |
| Slides      | 6     | `google.slides` v1       |

## Prerequisites

- **Node.js 18+**
- A **Google Cloud project** with billing/access to the Workspace APIs (free tier is fine)
- A Google account you can use as an OAuth **test user**

## Setup

### 1. Google Cloud Console

1. Create or select a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **Enable these APIs** (APIs & Services → Library):
   Google Sheets, Drive, Apps Script, Calendar, Gmail, Docs, Slides.
3. Configure the **OAuth consent screen**:
   - User type: **External**
   - Add your Google account under **Test users** (required — Gmail scopes are restricted, so unverified apps only work for listed test users).
4. Create credentials → **OAuth client ID** → **Web application**.
   - Add the authorized redirect URI: `http://localhost:3000/oauth2callback`
   - Copy the **Client ID** and **Client secret**.

### 2. Configure credentials

```bash
cp .env.example .env
```

Fill in your values:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
TOKEN_PATH=./tokens/google-tokens.json
```

### 3. Install dependencies

```bash
npm install
```

### 4. Authenticate (one time)

```bash
npm run auth
```

This opens a browser for Google consent. On the "unverified app" warning, click **Advanced → Go to (app) → Continue** (you must be a listed test user). Tokens are saved to `tokens/google-tokens.json` and auto-refresh from then on.

> If you later add new OAuth scopes, re-run `npm run auth` — existing tokens won't cover new scopes.

## Connecting to an MCP client

### Claude Code

```bash
claude mcp add google-workspace -- node /absolute/path/to/google_workspace_MCP/src/index.js
```

On Windows, use a forward-slash path to avoid backslash stripping:

```bash
claude mcp add google-workspace -- node C:/google_workspace_MCP/src/index.js
```

Verify it connected:

```bash
claude mcp list
```

The tools become available in a **new session** (MCP servers load at session start).

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["C:/google_workspace_MCP/src/index.js"]
    }
  }
}
```

Restart Claude Desktop.

## Commands

```bash
npm run auth    # one-time OAuth2 browser login
npm start       # start the MCP server (stdio transport)
```

## OAuth scopes

The server requests the full Workspace scope set up front (`src/auth.js`):

```
script.projects   script.deployments   script.processes
drive   spreadsheets
calendar
gmail.modify   gmail.send
documents   presentations
```

`gmail.modify` and `gmail.send` are **restricted scopes**. To shrink the consent screen, trim the scopes in `auth.js` and skip registering the matching service's tools in `index.js`, then re-run `npm run auth`.

## Project structure

```
src/
  index.js              # MCP entry point: boots server, constructs clients, registers all tools
  auth.js               # OAuth2 flow with token persistence; defines the full scope list
  clients/              # one Google API wrapper class per service
    sheets.js  drive.js  apps-script.js  calendar.js  gmail.js  docs.js  slides.js
  tools/                # one tool-registration module per service
    sheets.tools.js  drive.tools.js  apps-script.tools.js
    calendar.tools.js  gmail.tools.js  docs.tools.js  slides.tools.js

tokens/                 # persisted OAuth tokens (gitignored)
.env                    # Google OAuth credentials (gitignored)
.env.example            # credential template
```

### Architecture

- **One OAuth client, all scopes.** `auth.js` requests every scope; the same authenticated `auth` object is handed to all seven client classes in `index.js`.
- **Clients are thin API wrappers.** Each `clients/*.js` class takes `auth`, builds its `google.<service>(...)` handle, and exposes plain async methods returning `res.data`.
- **Tools are registered per service.** Each `tools/*.tools.js` exports `register<Name>Tools(server, client, handler)`, defining `server.tool(name, description, zodSchema, handler)` blocks.
- **`handler(fn)`** wraps every tool: serializes results to JSON text, and on error returns `{ isError: true }` with the Google API error message.

## Adding a new Google API

1. `src/clients/<name>.js` — a class taking `auth`, building `google.<name>({version, auth})`, with async methods.
2. `src/tools/<name>.tools.js` — `export function register<Name>Tools(server, client, handler) { server.tool(...) }`.
3. `src/index.js` — import the client + register function, add the client to the `clients` object, and call the register function.
4. `src/auth.js` — add any new OAuth scope(s) to `SCOPES`, then re-run `npm run auth`.

## Usage notes

- **Sheets** uses **A1 notation** for ranges (e.g. `'Sheet1'!A1:C10`); structural ops use **0-based grid indices, end-exclusive**.
- **Apps Script**: `gas_update_content` is a **FULL REPLACEMENT** of project files — always `gas_get_content` first. `gas_run_script` requires the script deployed as an **API executable**.
- **Calendar**: all-day events use `YYYY-MM-DD`; timed events use full ISO datetime (e.g. `2026-06-01T09:00:00+08:00`).
- **Gmail** send builds a base64url-encoded RFC 2822 message.
- **Drive** has both `drive_trash_file` (reversible) and `drive_delete_file` (permanent) — prefer trash.
- **Docs/Slides** `*_batch_update` tools accept raw API request arrays for advanced edits.

## Security

- `.env` and `tokens/` are gitignored — **never commit** your client secret or tokens.
- Tokens grant broad access to your Google account. Treat `tokens/google-tokens.json` like a password.
- The server runs locally over stdio; no data leaves your machine except calls to Google's APIs.
