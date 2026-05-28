import { google } from "googleapis";

export class SheetsClient {
  constructor(auth) {
    this.sheets = google.sheets({ version: "v4", auth });
    this.drive = google.drive({ version: "v3", auth });
  }

  async createSpreadsheet(title, folderId) {
    const res = await this.sheets.spreadsheets.create({
      requestBody: { properties: { title } },
    });
    if (folderId) {
      await this.moveToFolder(res.data.spreadsheetId, folderId);
    }
    return res.data;
  }

  async moveToFolder(fileId, folderId) {
    const file = await this.drive.files.get({ fileId, fields: "parents" });
    const previousParents = (file.data.parents || []).join(",");
    await this.drive.files.update({
      fileId,
      addParents: folderId,
      removeParents: previousParents,
      fields: "id,parents",
    });
  }

  async getSpreadsheetInfo(spreadsheetId) {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId,
      fields: "spreadsheetId,properties.title,sheets.properties,namedRanges",
    });
    return res.data;
  }

  async listSpreadsheets(pageSize = 20, query) {
    let q = "mimeType='application/vnd.google-apps.spreadsheet'";
    if (query) q += ` and ${query}`;
    const res = await this.drive.files.list({
      q,
      pageSize,
      fields: "files(id,name,createdTime,modifiedTime,owners)",
      orderBy: "modifiedTime desc",
    });
    return res.data;
  }

  async readRange(spreadsheetId, range, valueRenderOption = "FORMATTED_VALUE") {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption,
    });
    return res.data;
  }

  async readFormulas(spreadsheetId, range) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "FORMULA",
    });
    return res.data;
  }

  async batchRead(spreadsheetId, ranges, valueRenderOption = "FORMATTED_VALUE") {
    const res = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption,
    });
    return res.data;
  }

  async writeRange(spreadsheetId, range, values, valueInputOption = "USER_ENTERED") {
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values },
    });
    return res.data;
  }

  async appendRows(spreadsheetId, range, values, valueInputOption = "USER_ENTERED") {
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption,
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    return res.data;
  }

  async batchWrite(spreadsheetId, data, valueInputOption = "USER_ENTERED") {
    const res = await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption, data },
    });
    return res.data;
  }

  async clearRange(spreadsheetId, range) {
    const res = await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
      requestBody: {},
    });
    return res.data;
  }

  async addSheet(spreadsheetId, title, rowCount, columnCount) {
    const properties = { title };
    if (rowCount) properties.gridProperties = { rowCount, columnCount: columnCount || 26 };
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties } }] },
    });
    return res.data;
  }

  async deleteSheet(spreadsheetId, sheetId) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteSheet: { sheetId } }] },
    });
    return res.data;
  }

  async renameSheet(spreadsheetId, sheetId, newTitle) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { updateSheetProperties: { properties: { sheetId, title: newTitle }, fields: "title" } },
        ],
      },
    });
    return res.data;
  }

  async duplicateSheet(spreadsheetId, sheetId, newTitle, insertIndex) {
    const request = { sourceSheetId: sheetId, newSheetName: newTitle };
    if (insertIndex !== undefined) request.insertSheetIndex = insertIndex;
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ duplicateSheet: request }] },
    });
    return res.data;
  }

  async insertRowsOrColumns(spreadsheetId, sheetId, dimension, startIndex, endIndex) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: { sheetId, dimension, startIndex, endIndex },
              inheritFromBefore: startIndex > 0,
            },
          },
        ],
      },
    });
    return res.data;
  }

  async deleteRowsOrColumns(spreadsheetId, sheetId, dimension, startIndex, endIndex) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension, startIndex, endIndex } } }],
      },
    });
    return res.data;
  }

  async formatCells(spreadsheetId, sheetId, range, format) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: range.startRowIndex,
                endRowIndex: range.endRowIndex,
                startColumnIndex: range.startColumnIndex,
                endColumnIndex: range.endColumnIndex,
              },
              cell: { userEnteredFormat: format },
              fields: `userEnteredFormat(${Object.keys(format).join(",")})`,
            },
          },
        ],
      },
    });
    return res.data;
  }

  async sortRange(spreadsheetId, sheetId, range, sortSpecs) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            sortRange: {
              range: {
                sheetId,
                startRowIndex: range.startRowIndex,
                endRowIndex: range.endRowIndex,
                startColumnIndex: range.startColumnIndex,
                endColumnIndex: range.endColumnIndex,
              },
              sortSpecs,
            },
          },
        ],
      },
    });
    return res.data;
  }

  async mergeCells(spreadsheetId, sheetId, range, mergeType = "MERGE_ALL") {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            mergeCells: {
              range: {
                sheetId,
                startRowIndex: range.startRowIndex,
                endRowIndex: range.endRowIndex,
                startColumnIndex: range.startColumnIndex,
                endColumnIndex: range.endColumnIndex,
              },
              mergeType,
            },
          },
        ],
      },
    });
    return res.data;
  }

  async addChart(spreadsheetId, sheetId, chartSpec) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addChart: {
              chart: {
                spec: chartSpec,
                position: {
                  overlayPosition: { anchorCell: { sheetId, rowIndex: 0, columnIndex: 0 } },
                },
              },
            },
          },
        ],
      },
    });
    return res.data;
  }

  async findInSheet(spreadsheetId, searchText, range) {
    const data = await this.readRange(spreadsheetId, range || "A:ZZ");
    const results = [];
    if (!data.values) return { matches: [] };
    for (let r = 0; r < data.values.length; r++) {
      for (let c = 0; c < data.values[r].length; c++) {
        const val = String(data.values[r][c] || "");
        if (val.toLowerCase().includes(searchText.toLowerCase())) {
          results.push({
            row: r + 1,
            column: c + 1,
            cell: `${String.fromCharCode(65 + c)}${r + 1}`,
            value: val,
          });
        }
      }
    }
    return { matches: results, totalFound: results.length };
  }

  async getSpreadsheetSummary(spreadsheetId) {
    const info = await this.getSpreadsheetInfo(spreadsheetId);
    const summary = { title: info.properties.title, spreadsheetId: info.spreadsheetId, sheets: [] };
    for (const sheet of info.sheets) {
      const props = sheet.properties;
      const range = `'${props.title}'!1:3`;
      try {
        const preview = await this.readRange(spreadsheetId, range);
        summary.sheets.push({
          sheetId: props.sheetId,
          title: props.title,
          rowCount: props.gridProperties.rowCount,
          columnCount: props.gridProperties.columnCount,
          headers: preview.values?.[0] || [],
          sampleRows: preview.values?.slice(1) || [],
        });
      } catch {
        summary.sheets.push({
          sheetId: props.sheetId,
          title: props.title,
          rowCount: props.gridProperties.rowCount,
          columnCount: props.gridProperties.columnCount,
          headers: [],
          sampleRows: [],
        });
      }
    }
    return summary;
  }

  async shareSpreadsheet(spreadsheetId, email, role = "writer") {
    const res = await this.drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type: "user", role, emailAddress: email },
    });
    return res.data;
  }

  async freezeRowsAndColumns(spreadsheetId, sheetId, frozenRowCount, frozenColumnCount) {
    const properties = { sheetId };
    const fields = [];
    if (frozenRowCount !== undefined) {
      properties.gridProperties = { ...properties.gridProperties, frozenRowCount };
      fields.push("gridProperties.frozenRowCount");
    }
    if (frozenColumnCount !== undefined) {
      properties.gridProperties = { ...properties.gridProperties, frozenColumnCount };
      fields.push("gridProperties.frozenColumnCount");
    }
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ updateSheetProperties: { properties, fields: fields.join(",") } }],
      },
    });
    return res.data;
  }

  async autoResizeColumns(spreadsheetId, sheetId, startIndex, endIndex) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS", startIndex, endIndex },
            },
          },
        ],
      },
    });
    return res.data;
  }

  async setConditionalFormatting(spreadsheetId, sheetId, range, rule) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    sheetId,
                    startRowIndex: range.startRowIndex,
                    endRowIndex: range.endRowIndex,
                    startColumnIndex: range.startColumnIndex,
                    endColumnIndex: range.endColumnIndex,
                  },
                ],
                ...rule,
              },
              index: 0,
            },
          },
        ],
      },
    });
    return res.data;
  }
}
