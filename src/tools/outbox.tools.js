import { z } from "zod";
import { sendOutbox } from "../clients/outbox.js";

export function registerOutboxTools(server, { gmail, sheets }, handler) {
  server.tool(
    "gmail_send_outbox",
    "Send the emails queued in an outbox sheet tab, exactly as written there. Sends only rows whose state is READY and whose expected_from is the authenticated account, marks each row SENDING then SENT (with time and message id) or FAILED. Recipient, subject and body always come from the row, never from the caller. Use dryRun to list what would be sent.",
    {
      spreadsheetId: z.string(),
      tab: z.string().optional().describe("Outbox tab name (default OUTBOX)"),
      max: z.number().int().optional().describe("Most emails to send in this call (default 5, limit 20)"),
      dryRun: z.boolean().optional().describe("List what would be sent without sending or writing anything"),
    },
    handler(async ({ spreadsheetId, tab, max, dryRun }) =>
      sendOutbox({ gmail, sheets, spreadsheetId, tab, max, dryRun })
    )
  );
}
