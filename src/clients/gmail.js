import { google } from "googleapis";

function buildRawMessage({ to, subject, body, cc, bcc, from }) {
  const headers = [];
  if (from) headers.push(`From: ${from}`);
  headers.push(`To: ${to}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  headers.push(`Subject: ${subject}`);
  headers.push("MIME-Version: 1.0");
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  const message = `${headers.join("\r\n")}\r\n\r\n${body}`;
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

  async sendMessage({ to, subject, body, cc, bcc }) {
    const raw = buildRawMessage({ to, subject, body, cc, bcc });
    const res = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    return res.data;
  }

  async createDraft({ to, subject, body, cc, bcc }) {
    const raw = buildRawMessage({ to, subject, body, cc, bcc });
    const res = await this.gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    });
    return res.data;
  }

  async listLabels() {
    const res = await this.gmail.users.labels.list({ userId: "me" });
    return res.data.labels;
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
