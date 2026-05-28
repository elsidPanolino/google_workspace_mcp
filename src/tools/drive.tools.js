import { z } from "zod";

export function registerDriveTools(server, client, handler) {
  server.tool(
    "drive_list_files",
    "List/search Drive files using a Drive query, e.g. \"name contains 'report' and mimeType='application/pdf'\".",
    {
      query: z.string().optional().describe("Drive query string"),
      pageSize: z.number().optional(),
      orderBy: z.string().optional().describe("e.g. 'modifiedTime desc'"),
    },
    handler(async ({ query, pageSize, orderBy }) =>
      client.listFiles(query, pageSize || 25, orderBy || "modifiedTime desc")
    )
  );

  server.tool(
    "drive_get_metadata",
    "Get metadata for a file or folder.",
    { fileId: z.string() },
    handler(async ({ fileId }) => client.getFileMetadata(fileId))
  );

  server.tool(
    "drive_create_folder",
    "Create a folder, optionally inside a parent folder.",
    { name: z.string(), parentId: z.string().optional() },
    handler(async ({ name, parentId }) => client.createFolder(name, parentId))
  );

  server.tool(
    "drive_move_file",
    "Move a file into a folder (reparents it).",
    { fileId: z.string(), folderId: z.string() },
    handler(async ({ fileId, folderId }) => client.moveFile(fileId, folderId))
  );

  server.tool(
    "drive_copy_file",
    "Copy a file, optionally renaming and placing in a folder.",
    { fileId: z.string(), newName: z.string().optional(), parentId: z.string().optional() },
    handler(async ({ fileId, newName, parentId }) => client.copyFile(fileId, newName, parentId))
  );

  server.tool(
    "drive_rename_file",
    "Rename a file or folder.",
    { fileId: z.string(), newName: z.string() },
    handler(async ({ fileId, newName }) => client.renameFile(fileId, newName))
  );

  server.tool(
    "drive_trash_file",
    "Move a file to trash (reversible).",
    { fileId: z.string() },
    handler(async ({ fileId }) => client.trashFile(fileId))
  );

  server.tool(
    "drive_delete_file",
    "Permanently delete a file (NOT reversible). Prefer drive_trash_file unless you are sure.",
    { fileId: z.string() },
    handler(async ({ fileId }) => client.deleteFile(fileId))
  );

  server.tool(
    "drive_share",
    "Share a file with a user. role = reader | writer | commenter | owner.",
    {
      fileId: z.string(),
      email: z.string(),
      role: z.enum(["reader", "writer", "commenter", "owner"]).optional(),
      sendNotification: z.boolean().optional(),
    },
    handler(async ({ fileId, email, role, sendNotification }) =>
      client.shareFile(fileId, email, role, sendNotification)
    )
  );

  server.tool(
    "drive_list_permissions",
    "List who has access to a file.",
    { fileId: z.string() },
    handler(async ({ fileId }) => client.listPermissions(fileId))
  );

  server.tool(
    "drive_read_file",
    "Read raw content of a non-Google file (text). For Google Docs/Sheets use drive_export_file.",
    { fileId: z.string() },
    handler(async ({ fileId }) => client.readFileContent(fileId))
  );

  server.tool(
    "drive_export_file",
    "Export a Google-native file (Doc/Sheet/Slide) to a mimeType, e.g. text/plain, text/csv, application/pdf.",
    { fileId: z.string(), mimeType: z.string().optional() },
    handler(async ({ fileId, mimeType }) => client.exportFile(fileId, mimeType))
  );
}
