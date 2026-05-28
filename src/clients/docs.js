import { google } from "googleapis";

export class DocsClient {
  constructor(auth) {
    this.docs = google.docs({ version: "v1", auth });
    this.drive = google.drive({ version: "v3", auth });
  }

  async createDocument(title, folderId) {
    const res = await this.docs.documents.create({ requestBody: { title } });
    const documentId = res.data.documentId;
    if (folderId) {
      const file = await this.drive.files.get({ fileId: documentId, fields: "parents" });
      const previousParents = (file.data.parents || []).join(",");
      await this.drive.files.update({
        fileId: documentId,
        addParents: folderId,
        removeParents: previousParents,
        fields: "id,parents",
      });
    }
    return res.data;
  }

  async getDocument(documentId) {
    const res = await this.docs.documents.get({ documentId });
    return res.data;
  }

  // Extract plain text from a document's body for quick reading.
  async getText(documentId) {
    const res = await this.docs.documents.get({ documentId });
    const content = res.data.body?.content || [];
    let text = "";
    for (const el of content) {
      const elements = el.paragraph?.elements || [];
      for (const e of elements) {
        if (e.textRun?.content) text += e.textRun.content;
      }
    }
    return { documentId, title: res.data.title, text };
  }

  async batchUpdate(documentId, requests) {
    const res = await this.docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
    return res.data;
  }

  // Append text to the end of the document body.
  async appendText(documentId, text) {
    const doc = await this.docs.documents.get({ documentId });
    const content = doc.data.body?.content || [];
    // endIndex of the last structural element, minus 1 (the trailing newline segment).
    const endIndex = content[content.length - 1]?.endIndex || 1;
    return this.batchUpdate(documentId, [
      { insertText: { location: { index: endIndex - 1 }, text } },
    ]);
  }

  async replaceText(documentId, find, replace, matchCase = false) {
    return this.batchUpdate(documentId, [
      {
        replaceAllText: {
          containsText: { text: find, matchCase },
          replaceText: replace,
        },
      },
    ]);
  }
}
