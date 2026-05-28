import { z } from "zod";

const gridRange = z.object({
  startRowIndex: z.number().optional(),
  endRowIndex: z.number().optional(),
  startColumnIndex: z.number().optional(),
  endColumnIndex: z.number().optional(),
});

export function registerSheetsTools(server, client, handler) {
  server.tool(
    "sheets_create",
    "Create a new Google Spreadsheet. Provide folderId to place it in a specific Drive folder.",
    {
      title: z.string().describe("Spreadsheet title"),
      folderId: z.string().optional().describe("Drive folder ID to place the file in"),
    },
    handler(async ({ title, folderId }) => client.createSpreadsheet(title, folderId))
  );

  server.tool(
    "sheets_list",
    "List spreadsheets accessible to the user.",
    {
      pageSize: z.number().optional().describe("Max results (default 20)"),
      query: z.string().optional().describe("Extra Drive query filter"),
    },
    handler(async ({ pageSize, query }) => client.listSpreadsheets(pageSize || 20, query))
  );

  server.tool(
    "sheets_get_info",
    "Get spreadsheet metadata: title, all tabs with sheetId/gridProperties, named ranges.",
    { spreadsheetId: z.string() },
    handler(async ({ spreadsheetId }) => client.getSpreadsheetInfo(spreadsheetId))
  );

  server.tool(
    "sheets_summary",
    "Get a structured summary of every tab with headers and a few sample rows.",
    { spreadsheetId: z.string() },
    handler(async ({ spreadsheetId }) => client.getSpreadsheetSummary(spreadsheetId))
  );

  server.tool(
    "sheets_read",
    "Read values from a range in A1 notation, e.g. 'Sheet1'!A1:C10.",
    {
      spreadsheetId: z.string(),
      range: z.string().describe("A1 notation range"),
      valueRenderOption: z.enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"]).optional(),
    },
    handler(async ({ spreadsheetId, range, valueRenderOption }) =>
      client.readRange(spreadsheetId, range, valueRenderOption)
    )
  );

  server.tool(
    "sheets_read_formulas",
    "Read the underlying formulas from a range.",
    { spreadsheetId: z.string(), range: z.string() },
    handler(async ({ spreadsheetId, range }) => client.readFormulas(spreadsheetId, range))
  );

  server.tool(
    "sheets_batch_read",
    "Read multiple ranges in one call.",
    {
      spreadsheetId: z.string(),
      ranges: z.array(z.string()),
      valueRenderOption: z.enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"]).optional(),
    },
    handler(async ({ spreadsheetId, ranges, valueRenderOption }) =>
      client.batchRead(spreadsheetId, ranges, valueRenderOption)
    )
  );

  server.tool(
    "sheets_write",
    "Write a 2D array of values to a range (overwrites).",
    {
      spreadsheetId: z.string(),
      range: z.string(),
      values: z.array(z.array(z.any())),
      valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional(),
    },
    handler(async ({ spreadsheetId, range, values, valueInputOption }) =>
      client.writeRange(spreadsheetId, range, values, valueInputOption)
    )
  );

  server.tool(
    "sheets_append",
    "Append rows after the last row of data in a range.",
    {
      spreadsheetId: z.string(),
      range: z.string(),
      values: z.array(z.array(z.any())),
      valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional(),
    },
    handler(async ({ spreadsheetId, range, values, valueInputOption }) =>
      client.appendRows(spreadsheetId, range, values, valueInputOption)
    )
  );

  server.tool(
    "sheets_batch_write",
    "Write to multiple ranges in one call. data = [{range, values}].",
    {
      spreadsheetId: z.string(),
      data: z.array(z.object({ range: z.string(), values: z.array(z.array(z.any())) })),
      valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional(),
    },
    handler(async ({ spreadsheetId, data, valueInputOption }) =>
      client.batchWrite(spreadsheetId, data, valueInputOption)
    )
  );

  server.tool(
    "sheets_clear",
    "Clear values from a range.",
    { spreadsheetId: z.string(), range: z.string() },
    handler(async ({ spreadsheetId, range }) => client.clearRange(spreadsheetId, range))
  );

  server.tool(
    "sheets_find",
    "Find cells containing text within a sheet/range.",
    {
      spreadsheetId: z.string(),
      searchText: z.string(),
      range: z.string().optional().describe("Range to search (default A:ZZ)"),
    },
    handler(async ({ spreadsheetId, searchText, range }) =>
      client.findInSheet(spreadsheetId, searchText, range)
    )
  );

  server.tool(
    "sheets_add_tab",
    "Add a new tab/sheet.",
    {
      spreadsheetId: z.string(),
      title: z.string(),
      rowCount: z.number().optional(),
      columnCount: z.number().optional(),
    },
    handler(async ({ spreadsheetId, title, rowCount, columnCount }) =>
      client.addSheet(spreadsheetId, title, rowCount, columnCount)
    )
  );

  server.tool(
    "sheets_delete_tab",
    "Delete a tab by its sheetId.",
    { spreadsheetId: z.string(), sheetId: z.number() },
    handler(async ({ spreadsheetId, sheetId }) => client.deleteSheet(spreadsheetId, sheetId))
  );

  server.tool(
    "sheets_rename_tab",
    "Rename a tab.",
    { spreadsheetId: z.string(), sheetId: z.number(), newTitle: z.string() },
    handler(async ({ spreadsheetId, sheetId, newTitle }) =>
      client.renameSheet(spreadsheetId, sheetId, newTitle)
    )
  );

  server.tool(
    "sheets_duplicate_tab",
    "Duplicate a tab.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      newTitle: z.string(),
      insertIndex: z.number().optional(),
    },
    handler(async ({ spreadsheetId, sheetId, newTitle, insertIndex }) =>
      client.duplicateSheet(spreadsheetId, sheetId, newTitle, insertIndex)
    )
  );

  server.tool(
    "sheets_insert_rows_columns",
    "Insert rows or columns. dimension = ROWS | COLUMNS. Indices are 0-based, end exclusive.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      dimension: z.enum(["ROWS", "COLUMNS"]),
      startIndex: z.number(),
      endIndex: z.number(),
    },
    handler(async ({ spreadsheetId, sheetId, dimension, startIndex, endIndex }) =>
      client.insertRowsOrColumns(spreadsheetId, sheetId, dimension, startIndex, endIndex)
    )
  );

  server.tool(
    "sheets_delete_rows_columns",
    "Delete rows or columns. dimension = ROWS | COLUMNS. Indices are 0-based, end exclusive.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      dimension: z.enum(["ROWS", "COLUMNS"]),
      startIndex: z.number(),
      endIndex: z.number(),
    },
    handler(async ({ spreadsheetId, sheetId, dimension, startIndex, endIndex }) =>
      client.deleteRowsOrColumns(spreadsheetId, sheetId, dimension, startIndex, endIndex)
    )
  );

  server.tool(
    "sheets_freeze",
    "Freeze rows and/or columns on a tab.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      frozenRowCount: z.number().optional(),
      frozenColumnCount: z.number().optional(),
    },
    handler(async ({ spreadsheetId, sheetId, frozenRowCount, frozenColumnCount }) =>
      client.freezeRowsAndColumns(spreadsheetId, sheetId, frozenRowCount, frozenColumnCount)
    )
  );

  server.tool(
    "sheets_auto_resize",
    "Auto-resize columns to fit content. Indices are 0-based, end exclusive.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      startIndex: z.number(),
      endIndex: z.number(),
    },
    handler(async ({ spreadsheetId, sheetId, startIndex, endIndex }) =>
      client.autoResizeColumns(spreadsheetId, sheetId, startIndex, endIndex)
    )
  );

  server.tool(
    "sheets_merge_cells",
    "Merge a range of cells. mergeType = MERGE_ALL | MERGE_COLUMNS | MERGE_ROWS.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      range: gridRange,
      mergeType: z.enum(["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"]).optional(),
    },
    handler(async ({ spreadsheetId, sheetId, range, mergeType }) =>
      client.mergeCells(spreadsheetId, sheetId, range, mergeType)
    )
  );

  server.tool(
    "sheets_sort",
    "Sort a range. sortSpecs = [{dimensionIndex, sortOrder}].",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      range: gridRange,
      sortSpecs: z.array(
        z.object({
          dimensionIndex: z.number(),
          sortOrder: z.enum(["ASCENDING", "DESCENDING"]),
        })
      ),
    },
    handler(async ({ spreadsheetId, sheetId, range, sortSpecs }) =>
      client.sortRange(spreadsheetId, sheetId, range, sortSpecs)
    )
  );

  server.tool(
    "sheets_format",
    "Apply cell formatting (userEnteredFormat object) to a range.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      range: gridRange,
      format: z.record(z.any()).describe("userEnteredFormat fields, e.g. {numberFormat, backgroundColor, textFormat}"),
    },
    handler(async ({ spreadsheetId, sheetId, range, format }) =>
      client.formatCells(spreadsheetId, sheetId, range, format)
    )
  );

  server.tool(
    "sheets_conditional_format",
    "Add a conditional formatting rule to a range.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      range: gridRange,
      rule: z.record(z.any()).describe("Rule body, e.g. {booleanRule:{...}} or {gradientRule:{...}}"),
    },
    handler(async ({ spreadsheetId, sheetId, range, rule }) =>
      client.setConditionalFormatting(spreadsheetId, sheetId, range, rule)
    )
  );

  server.tool(
    "sheets_add_chart",
    "Add a chart to a tab from a chart spec.",
    {
      spreadsheetId: z.string(),
      sheetId: z.number(),
      chartSpec: z.record(z.any()).describe("Sheets API ChartSpec object"),
    },
    handler(async ({ spreadsheetId, sheetId, chartSpec }) =>
      client.addChart(spreadsheetId, sheetId, chartSpec)
    )
  );

  server.tool(
    "sheets_share",
    "Share a spreadsheet with a user by email. role = reader | writer | commenter | owner.",
    {
      spreadsheetId: z.string(),
      email: z.string(),
      role: z.enum(["reader", "writer", "commenter", "owner"]).optional(),
    },
    handler(async ({ spreadsheetId, email, role }) =>
      client.shareSpreadsheet(spreadsheetId, email, role)
    )
  );
}
