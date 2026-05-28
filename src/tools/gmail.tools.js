import { z } from "zod";

export function registerGmailTools(server, client, handler) {
  server.tool(
    "gmail_list_messages",
    "Search messages using Gmail query syntax, e.g. 'from:boss@x.com is:unread newer_than:7d'.",
    { query: z.string().optional(), maxResults: z.number().optional() },
    handler(async ({ query, maxResults }) => client.listMessages(query, maxResults))
  );

  server.tool(
    "gmail_get_message",
    "Get a message by ID. format = full | metadata | minimal | raw.",
    {
      messageId: z.string(),
      format: z.enum(["full", "metadata", "minimal", "raw"]).optional(),
    },
    handler(async ({ messageId, format }) => client.getMessage(messageId, format))
  );

  server.tool(
    "gmail_send",
    "Send an email as the authenticated user.",
    {
      to: z.string().describe("Recipient(s), comma-separated"),
      subject: z.string(),
      body: z.string().describe("Plain-text body"),
      cc: z.string().optional(),
      bcc: z.string().optional(),
    },
    handler(async (args) => client.sendMessage(args))
  );

  server.tool(
    "gmail_create_draft",
    "Create a draft email (does not send).",
    {
      to: z.string(),
      subject: z.string(),
      body: z.string(),
      cc: z.string().optional(),
      bcc: z.string().optional(),
    },
    handler(async (args) => client.createDraft(args))
  );

  server.tool(
    "gmail_list_labels",
    "List Gmail labels (with their IDs).",
    {},
    handler(async () => client.listLabels())
  );

  server.tool(
    "gmail_modify_labels",
    "Add and/or remove labels on a message. Use label IDs from gmail_list_labels.",
    {
      messageId: z.string(),
      addLabelIds: z.array(z.string()).optional(),
      removeLabelIds: z.array(z.string()).optional(),
    },
    handler(async ({ messageId, addLabelIds, removeLabelIds }) =>
      client.modifyLabels(messageId, addLabelIds || [], removeLabelIds || [])
    )
  );

  server.tool(
    "gmail_trash_message",
    "Move a message to trash.",
    { messageId: z.string() },
    handler(async ({ messageId }) => client.trashMessage(messageId))
  );
}
