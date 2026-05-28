import { google } from "googleapis";

export class DriveClient {
  constructor(auth) {
    this.drive = google.drive({ version: "v3", auth });
  }

  async listFiles(query, pageSize = 25, orderBy = "modifiedTime desc") {
    const res = await this.drive.files.list({
      q: query,
      pageSize,
      orderBy,
      fields: "files(id,name,mimeType,createdTime,modifiedTime,owners,parents,webViewLink),nextPageToken",
    });
    return res.data;
  }

  async getFileMetadata(fileId) {
    const res = await this.drive.files.get({
      fileId,
      fields: "id,name,mimeType,createdTime,modifiedTime,owners,parents,size,webViewLink,trashed",
    });
    return res.data;
  }

  async createFolder(name, parentId) {
    const requestBody = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) requestBody.parents = [parentId];
    const res = await this.drive.files.create({
      requestBody,
      fields: "id,name,webViewLink,parents",
    });
    return res.data;
  }

  async moveFile(fileId, folderId) {
    const file = await this.drive.files.get({ fileId, fields: "parents" });
    const previousParents = (file.data.parents || []).join(",");
    const res = await this.drive.files.update({
      fileId,
      addParents: folderId,
      removeParents: previousParents,
      fields: "id,parents",
    });
    return res.data;
  }

  async copyFile(fileId, newName, parentId) {
    const requestBody = {};
    if (newName) requestBody.name = newName;
    if (parentId) requestBody.parents = [parentId];
    const res = await this.drive.files.copy({
      fileId,
      requestBody,
      fields: "id,name,webViewLink",
    });
    return res.data;
  }

  async renameFile(fileId, newName) {
    const res = await this.drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: "id,name",
    });
    return res.data;
  }

  async trashFile(fileId) {
    const res = await this.drive.files.update({
      fileId,
      requestBody: { trashed: true },
      fields: "id,name,trashed",
    });
    return res.data;
  }

  async deleteFile(fileId) {
    await this.drive.files.delete({ fileId });
    return { deleted: true, fileId };
  }

  async shareFile(fileId, email, role = "writer", sendNotification = false) {
    const res = await this.drive.permissions.create({
      fileId,
      sendNotificationEmail: sendNotification,
      requestBody: { type: "user", role, emailAddress: email },
      fields: "id,role,emailAddress",
    });
    return res.data;
  }

  async listPermissions(fileId) {
    const res = await this.drive.permissions.list({
      fileId,
      fields: "permissions(id,type,role,emailAddress,displayName)",
    });
    return res.data;
  }

  // Read a plain-text / non-Google file's content. For Google Docs/Sheets use export.
  async readFileContent(fileId) {
    const res = await this.drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    return { content: res.data };
  }

  // Export a Google-native file (Doc/Sheet/Slide) to a given mimeType, e.g. text/plain, application/pdf.
  async exportFile(fileId, mimeType = "text/plain") {
    const res = await this.drive.files.export(
      { fileId, mimeType },
      { responseType: "text" }
    );
    return { mimeType, content: res.data };
  }
}
