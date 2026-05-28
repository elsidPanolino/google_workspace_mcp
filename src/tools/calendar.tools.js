import { z } from "zod";

export function registerCalendarTools(server, client, handler) {
  server.tool(
    "calendar_list_calendars",
    "List calendars on the user's calendar list.",
    {},
    handler(async () => client.listCalendars())
  );

  server.tool(
    "calendar_list_events",
    "List events from a calendar within a time window.",
    {
      calendarId: z.string().optional().describe("Calendar ID (default 'primary')"),
      timeMin: z.string().optional().describe("ISO start (default now)"),
      timeMax: z.string().optional().describe("ISO end"),
      maxResults: z.number().optional(),
      query: z.string().optional().describe("Free-text search"),
    },
    handler(async ({ calendarId, timeMin, timeMax, maxResults, query }) =>
      client.listEvents(calendarId, timeMin, timeMax, maxResults, query)
    )
  );

  server.tool(
    "calendar_get_event",
    "Get a single event.",
    { calendarId: z.string().optional(), eventId: z.string() },
    handler(async ({ calendarId, eventId }) => client.getEvent(calendarId, eventId))
  );

  server.tool(
    "calendar_create_event",
    "Create an event. For all-day use YYYY-MM-DD; for timed use full ISO datetime (e.g. 2026-06-01T09:00:00+08:00).",
    {
      calendarId: z.string().optional(),
      summary: z.string(),
      start: z.string().describe("YYYY-MM-DD or ISO datetime"),
      end: z.string().describe("YYYY-MM-DD or ISO datetime"),
      description: z.string().optional(),
      location: z.string().optional(),
      attendees: z.array(z.string()).optional().describe("Attendee emails"),
      timeZone: z.string().optional().describe("IANA tz, e.g. Asia/Singapore"),
    },
    handler(async ({ calendarId, ...event }) => client.createEvent(calendarId, event))
  );

  server.tool(
    "calendar_update_event",
    "Patch fields on an existing event. patch = partial event resource.",
    {
      calendarId: z.string().optional(),
      eventId: z.string(),
      patch: z.record(z.any()),
    },
    handler(async ({ calendarId, eventId, patch }) =>
      client.updateEvent(calendarId, eventId, patch)
    )
  );

  server.tool(
    "calendar_delete_event",
    "Delete an event.",
    { calendarId: z.string().optional(), eventId: z.string() },
    handler(async ({ calendarId, eventId }) => client.deleteEvent(calendarId, eventId))
  );

  server.tool(
    "calendar_quick_add",
    "Create an event from natural language, e.g. 'Lunch with Sam tomorrow 1pm'.",
    { calendarId: z.string().optional(), text: z.string() },
    handler(async ({ calendarId, text }) => client.quickAdd(calendarId, text))
  );
}
