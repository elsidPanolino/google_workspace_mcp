import { google } from "googleapis";

export class SlidesClient {
  constructor(auth) {
    this.slides = google.slides({ version: "v1", auth });
    this.drive = google.drive({ version: "v3", auth });
  }

  async createPresentation(title, folderId) {
    const res = await this.slides.presentations.create({ requestBody: { title } });
    const presentationId = res.data.presentationId;
    if (folderId) {
      const file = await this.drive.files.get({ fileId: presentationId, fields: "parents" });
      const previousParents = (file.data.parents || []).join(",");
      await this.drive.files.update({
        fileId: presentationId,
        addParents: folderId,
        removeParents: previousParents,
        fields: "id,parents",
      });
    }
    return res.data;
  }

  async getPresentation(presentationId) {
    const res = await this.slides.presentations.get({ presentationId });
    return res.data;
  }

  async batchUpdate(presentationId, requests) {
    const res = await this.slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
    return res.data;
  }

  async addSlide(presentationId, layout = "BLANK") {
    return this.batchUpdate(presentationId, [
      { createSlide: { slideLayoutReference: { predefinedLayout: layout } } },
    ]);
  }

  // Create a textbox on a page and insert text into it.
  async addTextBox(presentationId, pageObjectId, text, { x = 100, y = 100, width = 400, height = 100 } = {}) {
    const boxId = `tb_${Date.now()}`;
    return this.batchUpdate(presentationId, [
      {
        createShape: {
          objectId: boxId,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId,
            size: {
              width: { magnitude: width, unit: "PT" },
              height: { magnitude: height, unit: "PT" },
            },
            transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: "PT" },
          },
        },
      },
      { insertText: { objectId: boxId, text } },
    ]);
  }

  async replaceText(presentationId, find, replace, matchCase = false) {
    return this.batchUpdate(presentationId, [
      {
        replaceAllText: {
          containsText: { text: find, matchCase },
          replaceText: replace,
        },
      },
    ]);
  }
}
