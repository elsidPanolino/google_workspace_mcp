import { google } from "googleapis";
import { readFileSync } from "fs";
import { dirname, join, resolve, sep } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// htmlPath: a local HTML file inside the repo's scripts/ folder (same rule as gas_put_file)
function readHtmlFile(htmlPath) {
  const full = resolve(REPO_ROOT, htmlPath);
  const root = join(REPO_ROOT, "scripts") + sep;
  const allowed = process.platform === "win32"
    ? full.toLowerCase().startsWith(root.toLowerCase())
    : full.startsWith(root);
  if (!allowed) throw new Error(`htmlPath must be inside the repo's scripts/ folder: ${full}`);
  const html = readFileSync(full, "utf8");
  if (!html.trim()) throw new Error(`HTML file is empty: ${full}`);
  return html;
}

function resolveHtml({ html, htmlPath }) {
  if (html && htmlPath) throw new Error("Pass html or htmlPath, not both.");
  return htmlPath ? readHtmlFile(htmlPath) : html;
}

// RFC 2047 encoded-word so non-ASCII subjects (em dashes, accents) survive
function encodeHeader(value) {
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// base64 split into 76-char lines (RFC 2045), so long HTML lines never break SMTP limits
function base64Lines(text) {
  return Buffer.from(text, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
}

// A header value must stay on one line, or text after a line break becomes a new header
function oneLine(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

export function buildRawMessage({ to, subject, body, html, cc, bcc, from, replyTo }) {
  const headers = [];
  if (from) headers.push(`From: ${oneLine(from)}`);
  headers.push(`To: ${oneLine(to)}`);
  if (cc) headers.push(`Cc: ${oneLine(cc)}`);
  if (bcc) headers.push(`Bcc: ${oneLine(bcc)}`);
  if (replyTo) headers.push(`Reply-To: ${oneLine(replyTo)}`);
  headers.push(`Subject: ${encodeHeader(oneLine(subject))}`);
  headers.push("MIME-Version: 1.0");
  let content;
  if (html) {
    // multipart/alternative: plain-text fallback first, HTML last (preferred by clients)
    const boundary = `alt_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    content = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(body),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(html),
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    content = body;
  }
  const message = `${headers.join("\r\n")}\r\n\r\n${content}`;
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class GmailClient {
  constructor(auth) {
    this.gmail = google.gmail({ version: "v1", auth });
  }

  async listMessages(query, maxResults = 20) {
    const res = await this.gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });
    return res.data;
  }

  async getMessage(messageId, format = "full") {
    const res = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format,
    });
    return res.data;
  }

  // From header with a display name, on the authenticated account's own address
  // The authenticated account's own address
  async getAddress() {
    if (!this.address) {
      const res = await this.gmail.users.getProfile({ userId: "me" });
      this.address = res.data.emailAddress;
    }
    return this.address;
  }

  async fromHeader(fromName) {
    if (!fromName) return undefined;
    const address = await this.getAddress();
    fromName = oneLine(fromName);
    const name = /^[\x20-\x7e]*$/.test(fromName)
      ? `"${fromName.replace(/["\\]/g, "\\$&")}"`
      : encodeHeader(fromName);
    return `${name} <${address}>`;
  }

  async sendMessage({ to, subject, body, html, htmlPath, fromName, cc, bcc, replyTo }) {
    const from = await this.fromHeader(fromName);
    const raw = buildRawMessage({ to, subject, body, html: resolveHtml({ html, htmlPath }), cc, bcc, from, replyTo });
    const res = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    return res.data;
  }

  async createDraft({ to, subject, body, html, htmlPath, fromName, cc, bcc, replyTo }) {
    const from = await this.fromHeader(fromName);
    const raw = buildRawMessage({ to, subject, body, html: resolveHtml({ html, htmlPath }), cc, bcc, from, replyTo });
    const res = await this.gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    });
    return res.data;
  }

  async listLabels() {
    const res = await this.gmail.users.labels.list({ userId: "me" });
    return res.data;
  }

  async modifyLabels(messageId, addLabelIds = [], removeLabelIds = []) {
    const res = await this.gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { addLabelIds, removeLabelIds },
    });
    return res.data;
  }

  async trashMessage(messageId) {
    const res = await this.gmail.users.messages.trash({ userId: "me", id: messageId });
    return res.data;
  }
}
