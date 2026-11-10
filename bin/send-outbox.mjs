#!/usr/bin/env node
// Send the emails queued in an outbox sheet tab and write one report row per run.
// No AI involved: this runs the same code as the gmail_send_outbox tool, on a timer.
//
// Usage:
//   TOKEN_PATH=<token file> node bin/send-outbox.mjs --sheet <spreadsheetId> [options]
//
//   --sheet <id>       the spreadsheet that holds the outbox tab (required)
//   --tab <name>       outbox tab (default OUTBOX)
//   --log-tab <name>   tab that gets one report row per run (default SEND_LOG; "none" = no sheet report)
//   --max <n>          most emails per run (default 5)
//   --tz <zone>        time zone for the report's ran_at (default Asia/Manila)
//   --dry-run          list what would be sent; sends nothing and writes nothing
//
// The account is whichever one TOKEN_PATH is signed in as. Every run also prints its
// report as one JSON line, so a timer's log file has it even when the sheet cannot be reached.
// Exit code: 0 = ran clean, 1 = could not run, 2 = ran but something needs a person.

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : fallback; };
const spreadsheetId = arg("--sheet");
const tab = arg("--tab", "OUTBOX");
const logTab = arg("--log-tab", "SEND_LOG");
const max = Number(arg("--max", 5));
const tz = arg("--tz", "Asia/Manila");
const dryRun = args.includes("--dry-run");

if (!spreadsheetId) {
  console.error("Usage: node bin/send-outbox.mjs --sheet <spreadsheetId> [--tab OUTBOX] [--log-tab SEND_LOG] [--max 5] [--dry-run]");
  process.exit(1);
}

// "2026-11-10 12:30:05" in the report's time zone
const stamp = () => new Date().toLocaleString("sv-SE", { timeZone: tz });
const print = (obj) => console.log(JSON.stringify({ at: stamp(), ...obj }));

let gmail, sheets, sendOutbox, outboxReportRow;
try {
  const { getAuthClient } = await import("../src/auth.js");
  const { GmailClient } = await import("../src/clients/gmail.js");
  const { SheetsClient } = await import("../src/clients/sheets.js");
  ({ sendOutbox, outboxReportRow } = await import("../src/clients/outbox.js"));
  const auth = await getAuthClient();
  gmail = new GmailClient(auth);
  sheets = new SheetsClient(auth);
} catch (error) {
  print({ result: "ERROR", error: `could not start: ${error.message}` });
  process.exit(1);
}

const message = (error) => String(error.response?.data?.error?.message || error.message);
const quoted = (name) => `'${name.replace(/'/g, "''")}'`;
async function report(row) {
  if (dryRun || logTab === "none") return;
  try {
    await sheets.appendRows(spreadsheetId, quoted(logTab), [row], "RAW");
  } catch (error) {
    print({ result: "REPORT NOT WRITTEN", error: message(error) });
  }
}

let result;
try {
  result = await sendOutbox({ gmail, sheets, spreadsheetId, tab, max, dryRun });
} catch (error) {
  // e.g. the sign-in has expired, the tab is missing, or Google cannot be reached
  const failure = { error: message(error), account: gmail.address };
  print({ result: "ERROR", ...failure });
  await report(outboxReportRow(failure, stamp()));
  process.exit(1);
}

const row = outboxReportRow(result, stamp());
print({ result: dryRun ? "DRY RUN" : row[2], ...result });
await report(row);
process.exit(row[2] === "PROBLEM" ? 2 : 0);
