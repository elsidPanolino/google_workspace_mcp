// Sends emails that another system has queued as rows of an "outbox" sheet tab.
// The caller never supplies a recipient or a body: every field comes from the row.
//
// Row states: READY -> SENDING -> SENT | FAILED. Only READY rows are ever sent.
// A row left in SENDING (a crash between "mark" and "send") is never retried here,
// so a doubtful row cannot be sent twice; it is reported for a person to look at.

export const OUTBOX_REQUIRED = [
  "to", "expected_from", "subject", "plain", "html", "state", "sent_at", "message_id", "note",
];

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function colLetter(index) {
  let n = index + 1, s = "";
  while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function text(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

// Pure: decide what to do with the tab's values (row 1 = headers). No I/O.
export function planOutbox(values, myAddress, max = 5) {
  const header = (values[0] || []).map((h) => text(h).toLowerCase());
  const col = {};
  header.forEach((h, i) => { if (h && !(h in col)) col[h] = i; });
  const missing = OUTBOX_REQUIRED.filter((h) => !(h in col));
  if (missing.length) throw new Error(`Outbox tab is missing column(s): ${missing.join(", ")}`);

  const me = text(myAddress).toLowerCase();
  const plan = { col, toSend: [], invalid: [], wrongAccount: [], stuck: [], readyLeft: 0 };
  for (let r = 1; r < values.length; r++) {
    const get = (name) => (name in col ? text(values[r][col[name]]) : "");
    const state = get("state").toUpperCase();
    const row = r + 1; // sheet row number
    if (state === "SENDING") { plan.stuck.push(row); continue; }
    if (state !== "READY") continue;

    if (get("expected_from").toLowerCase() !== me) {
      plan.wrongAccount.push({ row, expected_from: get("expected_from") });
      continue;
    }
    const to = get("to");
    const cc = get("cc");
    const problems = [];
    if (!EMAIL_RE.test(to)) problems.push("to is not one email address");
    if (cc && !cc.split(",").every((a) => EMAIL_RE.test(a.trim()))) problems.push("cc is not a list of email addresses");
    if (get("reply_to") && !EMAIL_RE.test(get("reply_to"))) problems.push("reply_to is not an email address");
    if (!get("subject")) problems.push("no subject");
    if (!get("plain")) problems.push("no plain text");
    if (!get("html")) problems.push("no html");
    if (problems.length) { plan.invalid.push({ row, to, problems }); continue; }

    if (plan.toSend.length >= max) { plan.readyLeft++; continue; }
    plan.toSend.push({
      row, to, cc,
      subject: get("subject"),
      body: get("plain"),
      // html is taken untrimmed, exactly as queued
      html: String(values[r][col.html]),
      fromName: get("sender_name"),
      replyTo: get("reply_to"),
    });
  }
  return plan;
}

export async function sendOutbox({ gmail, sheets, spreadsheetId, tab = "OUTBOX", max = 5, dryRun = false }) {
  max = Math.max(1, Math.min(20, max));
  const quoted = `'${tab.replace(/'/g, "''")}'`;
  const data = await sheets.readRange(spreadsheetId, quoted, "UNFORMATTED_VALUE");
  const me = await gmail.getAddress();
  const plan = planOutbox(data.values || [], me, max);

  const cell = (name, row) => `${quoted}!${colLetter(plan.col[name])}${row}`;
  const write = (row, fields) =>
    sheets.batchWrite(
      spreadsheetId,
      Object.entries(fields).map(([name, value]) => ({ range: cell(name, row), values: [[value]] })),
      "RAW"
    );

  const result = {
    account: me, tab, dryRun,
    sent: [], failed: [],
    invalid: plan.invalid, wrongAccount: plan.wrongAccount,
    stuckInSending: plan.stuck, readyLeftForNextRun: plan.readyLeft,
  };

  if (dryRun) {
    result.wouldSend = plan.toSend.map(({ row, to, subject }) => ({ row, to, subject }));
    return result;
  }

  // Rows that can never be sent as written are closed, so the queueing side can report them
  for (const bad of plan.invalid) {
    await write(bad.row, { state: "FAILED", note: `Not sent: ${bad.problems.join("; ")}` });
  }

  for (const item of plan.toSend) {
    const { row, ...message } = item;
    await write(row, { state: "SENDING" });
    try {
      const res = await gmail.sendMessage(message);
      await write(row, { state: "SENT", sent_at: new Date().toISOString(), message_id: res.id || "", note: "" });
      result.sent.push({ row, to: item.to, subject: item.subject, messageId: res.id });
    } catch (error) {
      const msg = String(error.response?.data?.error?.message || error.message).slice(0, 200);
      const status = error.code || error.response?.status;
      if (status === 429) {
        // Gmail refused for rate or daily limit: nothing went out, so the row can wait
        await write(row, { state: "READY", note: `Waiting: ${msg}` });
        result.stoppedEarly = `Gmail limit reached at row ${row}: ${msg}`;
        result.readyLeftForNextRun += plan.toSend.length - plan.toSend.indexOf(item);
        break;
      }
      await write(row, { state: "FAILED", note: `Send failed: ${msg}` });
      result.failed.push({ row, to: item.to, error: msg });
    }
  }
  return result;
}
