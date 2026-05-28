import { z } from "zod";

export function registerSlidesTools(server, client, handler) {
  server.tool(
    "slides_create",
    "Create a new Google Slides presentation, optionally in a folder.",
    { title: z.string(), folderId: z.string().optional() },
    handler(async ({ title, folderId }) => client.createPresentation(title, folderId))
  );

  server.tool(
    "slides_get",
    "Get the presentation resource (slides, page elements, etc.).",
    { presentationId: z.string() },
    handler(async ({ presentationId }) => client.getPresentation(presentationId))
  );

  server.tool(
    "slides_add_slide",
    "Add a new slide with a predefined layout (e.g. BLANK, TITLE, TITLE_AND_BODY).",
    { presentationId: z.string(), layout: z.string().optional() },
    handler(async ({ presentationId, layout }) => client.addSlide(presentationId, layout))
  );

  server.tool(
    "slides_add_text_box",
    "Create a text box on a slide page and insert text. pageObjectId comes from slides_get.",
    {
      presentationId: z.string(),
      pageObjectId: z.string(),
      text: z.string(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    },
    handler(async ({ presentationId, pageObjectId, text, x, y, width, height }) =>
      client.addTextBox(presentationId, pageObjectId, text, { x, y, width, height })
    )
  );

  server.tool(
    "slides_replace_text",
    "Replace all occurrences of a string across the presentation (great for templates).",
    {
      presentationId: z.string(),
      find: z.string(),
      replace: z.string(),
      matchCase: z.boolean().optional(),
    },
    handler(async ({ presentationId, find, replace, matchCase }) =>
      client.replaceText(presentationId, find, replace, matchCase)
    )
  );

  server.tool(
    "slides_batch_update",
    "Run raw Slides API batchUpdate requests for advanced edits.",
    { presentationId: z.string(), requests: z.array(z.record(z.any())) },
    handler(async ({ presentationId, requests }) => client.batchUpdate(presentationId, requests))
  );
}
