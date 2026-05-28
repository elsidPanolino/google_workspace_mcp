import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAuthClient } from "./auth.js";

import { SheetsClient } from "./clients/sheets.js";
import { DriveClient } from "./clients/drive.js";
import { AppsScriptClient } from "./clients/apps-script.js";
import { CalendarClient } from "./clients/calendar.js";
import { GmailClient } from "./clients/gmail.js";
import { DocsClient } from "./clients/docs.js";
import { SlidesClient } from "./clients/slides.js";

import { registerSheetsTools } from "./tools/sheets.tools.js";
import { registerDriveTools } from "./tools/drive.tools.js";
import { registerAppsScriptTools } from "./tools/apps-script.tools.js";
import { registerCalendarTools } from "./tools/calendar.tools.js";
import { registerGmailTools } from "./tools/gmail.tools.js";
import { registerDocsTools } from "./tools/docs.tools.js";
import { registerSlidesTools } from "./tools/slides.tools.js";

// --- Auth ---
const auth = await getAuthClient();

// --- Service clients ---
const clients = {
  sheets: new SheetsClient(auth),
  drive: new DriveClient(auth),
  script: new AppsScriptClient(auth),
  calendar: new CalendarClient(auth),
  gmail: new GmailClient(auth),
  docs: new DocsClient(auth),
  slides: new SlidesClient(auth),
};

// --- MCP server ---
const server = new McpServer({
  name: "google-workspace",
  version: "1.0.0",
});

// Wrap a handler with uniform JSON serialization + error handling.
function handler(fn) {
  return async (params) => {
    try {
      const result = await fn(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  };
}

// --- Register tools per service ---
registerSheetsTools(server, clients.sheets, handler);
registerDriveTools(server, clients.drive, handler);
registerAppsScriptTools(server, clients.script, handler);
registerCalendarTools(server, clients.calendar, handler);
registerGmailTools(server, clients.gmail, handler);
registerDocsTools(server, clients.docs, handler);
registerSlidesTools(server, clients.slides, handler);

// --- Start (stdio transport) ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Google Workspace MCP server running on stdio.");
