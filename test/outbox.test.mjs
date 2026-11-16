// Offline tests: no Google calls. Run with: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRawMessage } from "../src/clients/gmail.js";
import { planOutbox, sendOutbox } from "../src/clients/outbox.js";

const decode = (raw) => Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

const HEADER = ["queued_at", "award", "lead_tab", "lead_row", "to", "cc", "sender_name", "expected_from",
  "reply_to", "subject", "plain", "html", "state", "sent_at", "message_id", "note"];
const ME = "awards@new.example";
const row = (over = {}) => {
  const base = { to: "ann@co.com", cc: "", sender_name: "Asian Telecom Awards", expected_from: ME,
    reply_to: "awards@old.example", subject: "Hello", plain: "Hi Ann", html: "<p>Hi Ann</p>", state: "READY" };
  const r = { ...base, ...over };
  return HEADER.map((h) => r[h] ?? "");
};

test("Reply-To header is written", () => {
  const msg = decode(buildRawMessage({ to: "a@b.com", subject: "S", body: "x", replyTo: "r@b.com" }));
  assert.match(msg, /\r\nReply-To: r@b\.com\r\n/);
});

test("a line break in a header value cannot add a header", () => {
  const msg = decode(buildRawMessage({ to: "a@b.com", subject: "Hi\r\nBcc: evil@x.com", body: "x", cc: "c@b.com\nBcc: evil@x.com" }));
  const head = msg.split("\r\n\r\n")[0];
  assert.equal(head.split("\r\n").filter((l) => /^Bcc:/i.test(l)).length, 0);
});

test("only READY rows for this account are planned, up to max", () => {
  const values = [HEADER, row(), row({ state: "SENT" }), row({ state: "SENDING" }), row({ state: "" }),
    row({ expected_from: "other@x.com" }), row({ to: "a@b.com, c@d.com" }), row({ html: "" }),
    row({ to: "bob@co.com" }), row({ to: "cat@co.com" })];
  const plan = planOutbox(values, "Awards@New.Example", 2);
  assert.deepEqual(plan.toSend.map((m) => m.row), [2, 9]);
  assert.deepEqual(plan.stuck, [4]);
  assert.deepEqual(plan.wrongAccount.map((m) => m.row), [6]);
  assert.deepEqual(plan.invalid.map((m) => m.row), [7, 8]);
  assert.equal(plan.readyLeft, 1);
  assert.equal(plan.toSend[0].replyTo, "awards@old.example");
});

test("a missing column stops everything", () => {
  assert.throws(() => planOutbox([HEADER.filter((h) => h !== "state"), row()], ME), /missing column/);
});

function fakes(values, sendImpl) {
  const log = [];
  const sheets = {
    readRange: async () => ({ values }),
    batchWrite: async (_id, data, mode) => { log.push(["write", mode, ...data.map((d) => `${d.range}=${d.values[0][0]}`)]); },
  };
  const gmail = {
    getAddress: async () => ME,
    sendMessage: async (m) => { log.push(["send", m.to]); return sendImpl(m); },
  };
  return { sheets, gmail, log };
}

test("a row is marked SENDING before the send and SENT after", async () => {
  const { sheets, gmail, log } = fakes([HEADER, row()], async () => ({ id: "m1" }));
  const res = await sendOutbox({ gmail, sheets, spreadsheetId: "x" });
  assert.equal(log[0][2], "'OUTBOX'!M2=SENDING");
  assert.deepEqual(log[1], ["send", "ann@co.com"]);
  assert.ok(log[2].includes("'OUTBOX'!M2=SENT") && log[2].includes("'OUTBOX'!O2=m1"));
  assert.equal(log[2][1], "RAW");
  assert.equal(res.sent.length, 1);
});

test("the message carries the row's fields and nothing else", async () => {
  let got;
  const { sheets, gmail } = fakes([HEADER, row({ cc: "boss@co.com" })], async (m) => { got = m; return { id: "m1" }; });
  await sendOutbox({ gmail, sheets, spreadsheetId: "x" });
  assert.deepEqual(got, { to: "ann@co.com", cc: "boss@co.com", subject: "Hello", body: "Hi Ann",
    html: "<p>Hi Ann</p>", fromName: "Asian Telecom Awards", replyTo: "awards@old.example" });
});

test("a failed send is marked FAILED and the next row still goes", async () => {
  let n = 0;
  const { sheets, gmail, log } = fakes([HEADER, row(), row({ to: "bob@co.com" })],
    async () => { if (n++ === 0) throw new Error("boom"); return { id: "m2" }; });
  const res = await sendOutbox({ gmail, sheets, spreadsheetId: "x" });
  assert.ok(log.some((l) => l.includes("'OUTBOX'!M2=FAILED")));
  assert.ok(log.some((l) => l.includes("'OUTBOX'!M3=SENT")));
  assert.equal(res.failed.length, 1);
});

test("a Gmail limit error puts the row back to READY and stops", async () => {
  const { sheets, gmail, log } = fakes([HEADER, row(), row({ to: "bob@co.com" })],
    async () => { const e = new Error("limit"); e.code = 429; throw e; });
  const res = await sendOutbox({ gmail, sheets, spreadsheetId: "x" });
  assert.ok(log.some((l) => l.includes("'OUTBOX'!M2=READY")));
  assert.equal(log.filter((l) => l[0] === "send").length, 1);
  assert.equal(res.readyLeftForNextRun, 2);
});

test("dryRun sends and writes nothing", async () => {
  const { sheets, gmail, log } = fakes([HEADER, row(), row({ html: "" })], async () => ({ id: "m1" }));
  const res = await sendOutbox({ gmail, sheets, spreadsheetId: "x", dryRun: true });
  assert.equal(log.length, 0);
  assert.deepEqual(res.wouldSend, [{ row: 2, to: "ann@co.com", subject: "Hello" }]);
});

// ---- the report row written by bin/send-outbox.mjs ----
import { outboxReportRow, OUTBOX_LOG_HEADER } from "../src/clients/outbox.js";
const clean = { account: ME, sent: [], failed: [], invalid: [], wrongAccount: [], stuckInSending: [], readyLeftForNextRun: 0 };

test("report row: nothing to send", () => {
  const r = outboxReportRow(clean, "2026-11-10 12:30:00");
  assert.equal(r.length, OUTBOX_LOG_HEADER.length);
  assert.deepEqual(r, ["2026-11-10 12:30:00", ME, "NOTHING TO SEND", 0, 0, 0, 0, 0, ""]);
});

test("report row: a clean send lists recipient and subject", () => {
  const r = outboxReportRow({ ...clean, sent: [{ row: 2, to: "ann@co.com", subject: "Hello", messageId: "m1" }], readyLeftForNextRun: 1 }, "t");
  assert.deepEqual(r.slice(2, 8), ["SENT", 1, 0, 1, 0, 0]);
  assert.equal(r[8], "Sent row 2: ann@co.com | Hello");
});

test("report row: anything that needs a person is a PROBLEM", () => {
  const failed = outboxReportRow({ ...clean, sent: [{ row: 2, to: "a@b.com", subject: "S" }], failed: [{ row: 3, to: "x@y.com", error: "boom" }] }, "t");
  assert.equal(failed[2], "PROBLEM");
  assert.match(failed[8], /FAILED row 3: x@y\.com \| boom/);
  assert.equal(outboxReportRow({ ...clean, stuckInSending: [4] }, "t")[2], "PROBLEM");
  assert.equal(outboxReportRow({ ...clean, wrongAccount: [{ row: 5, expected_from: "o@x.com" }] }, "t")[7], 1);
  assert.equal(outboxReportRow({ ...clean, invalid: [{ row: 6, to: "", problems: ["no html"] }] }, "t")[2], "PROBLEM");
});

test("report row: a run that could not happen is an ERROR", () => {
  const r = outboxReportRow({ error: "invalid_grant", account: undefined }, "t");
  assert.deepEqual(r.slice(0, 5), ["t", "", "ERROR", 0, 0]);
  assert.equal(r[8], "invalid_grant");
});

// ---- follow-ups: a row with in_reply_to is sent as a reply inside that conversation ----
const FU_HEADER = [...HEADER, "lead_email", "kind", "in_reply_to"];
const fuRow = (over = {}) => {
  const base = { to: "ann@co.com", sender_name: "Asian Telecom", expected_from: ME, subject: "Re: Hello",
    plain: "Hi Ann", html: "<p>Hi Ann</p>", state: "READY" };
  const r = { ...base, ...over };
  return FU_HEADER.map((h) => r[h] ?? "");
};
const fuWorld = (values, threadRef) => {
  const sent = [], writes = [];
  return {
    sent, writes,
    gmail: { getAddress: async () => ME, threadRef,
      sendMessage: async (m) => { sent.push(m); return { id: "new1" }; } },
    sheets: { readRange: async () => ({ values }),
      batchWrite: async (id, data) => { writes.push(...data.map((d) => [d.range, d.values[0][0]])); } },
  };
};

test("In-Reply-To and References headers are written for a reply", () => {
  const msg = decode(buildRawMessage({ to: "a@b.com", subject: "Re: S", body: "x", inReplyTo: "<abc@mail.gmail.com>" }));
  assert.match(msg, /\r\nIn-Reply-To: <abc@mail\.gmail\.com>\r\n/);
  assert.match(msg, /\r\nReferences: <abc@mail\.gmail\.com>\r\n/);
  assert.doesNotMatch(decode(buildRawMessage({ to: "a@b.com", subject: "S", body: "x" })), /In-Reply-To|References/);
});

test("a row with in_reply_to is sent inside that conversation", async () => {
  const asked = [];
  const w = fuWorld([FU_HEADER, fuRow({ kind: "FOLLOWUP 1", in_reply_to: "orig1" })],
    async (id) => { asked.push(id); return { threadId: "t1", messageIdHeader: "<orig@mail.gmail.com>" }; });
  const res = await sendOutbox({ gmail: w.gmail, sheets: w.sheets, spreadsheetId: "s" });
  assert.deepEqual(asked, ["orig1"]);
  assert.equal(w.sent[0].threadId, "t1");
  assert.equal(w.sent[0].inReplyTo, "<orig@mail.gmail.com>");
  assert.equal(w.sent[0].replyToMessageId, undefined);
  assert.equal(res.sent.length, 1);
  assert.ok(w.writes.some(([range, v]) => /!P2$/.test(range) && v === ""), "no note on a clean threaded send");
});

test("when the earlier message cannot be found the email still goes, as a new one, and the row says so", async () => {
  const w = fuWorld([FU_HEADER, fuRow({ kind: "FOLLOWUP 1", in_reply_to: "gone" })],
    async () => { throw new Error("Requested entity was not found."); });
  const res = await sendOutbox({ gmail: w.gmail, sheets: w.sheets, spreadsheetId: "s" });
  assert.equal(res.sent.length, 1);
  assert.equal(w.sent[0].threadId, undefined);
  assert.equal(w.sent[0].inReplyTo, undefined);
  assert.ok(w.writes.some(([, v]) => /^Sent as a new email, not in the original conversation: Requested entity/.test(String(v))));
});

test("a row without in_reply_to (an invitation, or an older tab) is sent exactly as before", async () => {
  let asked = 0;
  const w = fuWorld([FU_HEADER, fuRow({ subject: "Hello" })], async () => { asked++; return {}; });
  await sendOutbox({ gmail: w.gmail, sheets: w.sheets, spreadsheetId: "s" });
  assert.equal(asked, 0);
  assert.deepEqual(Object.keys(w.sent[0]).sort(), ["body", "cc", "fromName", "html", "replyTo", "subject", "to"]);
  const old = fuWorld([HEADER, row()], async () => { asked++; return {}; });
  await sendOutbox({ gmail: old.gmail, sheets: old.sheets, spreadsheetId: "s" });
  assert.equal(asked, 0);
  assert.equal(old.sent.length, 1);
});
