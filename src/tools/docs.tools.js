import { z } from "zod";

export function registerDocsTools(server, client, handler) {
  server.tool(
    "docs_create",
    "Create a new Google Doc, optionally in a folder.",
    { title: z.string(), folderId: z.string().optional() },
    handler(async ({ title, folderId }) => client.createDocument(title, folderId))
  );

  server.tool(
    "docs_get",
    "Get the full structured document resource.",
    { documentId: z.string() },
    handler(async ({ documentId }) => client.getDocument(documentId))
  );

  server.tool(
    "docs_get_text",
    "Get the plain-text content of a document (quick read).",
    { documentId: z.string() },
    handler(async ({ documentId }) => client.getText(documentId))
  );

  server.tool(
    "docs_append_text",
    "Append text to the end of a document.",
    { documentId: z.string(), text: z.string() },
    handler(async ({ documentId, text }) => client.appendText(documentId, text))
  );

  server.tool(
    "docs_replace_text",
    "Replace all occurrences of a string in a document.",
    {
      documentId: z.string(),
      find: z.string(),
      replace: z.string(),
      matchCase: z.boolean().optional(),
    },
    handler(async ({ documentId, find, replace, matchCase }) =>
      client.replaceText(documentId, find, replace, matchCase)
    )
  );

  server.tool(
    "docs_batch_update",
    "Run raw Docs API batchUpdate requests for advanced edits.",
    { documentId: z.string(), requests: z.array(z.record(z.any())) },
    handler(async ({ documentId, requests }) => client.batchUpdate(documentId, requests))
  );
}
