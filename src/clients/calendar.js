import { google } from "googleapis";

export class CalendarClient {
  constructor(auth) {
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async listCalendars() {
    const res = await this.calendar.calendarList.list();
    return res.data.items;
  }

  async listEvents(calendarId = "primary", timeMin, timeMax, maxResults = 25, query) {
    const res = await this.calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      maxResults,
      q: query,
      singleEvents: true,
      orderBy: "startTime",
    });
    return res.data.items;
  }

  async getEvent(calendarId = "primary", eventId) {
    const res = await this.calendar.events.get({ calendarId, eventId });
    return res.data;
  }

  async createEvent(calendarId = "primary", { summary, description, location, start, end, attendees, timeZone }) {
    const requestBody = {
      summary,
      description,
      location,
      start: start.length <= 10 ? { date: start, timeZone } : { dateTime: start, timeZone },
      end: end.length <= 10 ? { date: end, timeZone } : { dateTime: end, timeZone },
    };
    if (attendees?.length) requestBody.attendees = attendees.map((email) => ({ email }));
    const res = await this.calendar.events.insert({ calendarId, requestBody });
    return res.data;
  }

  async updateEvent(calendarId = "primary", eventId, patch) {
    const res = await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody: patch,
    });
    return res.data;
  }

  async deleteEvent(calendarId = "primary", eventId) {
    await this.calendar.events.delete({ calendarId, eventId });
    return { deleted: true, eventId };
  }

  async quickAdd(calendarId = "primary", text) {
    const res = await this.calendar.events.quickAdd({ calendarId, text });
    return res.data;
  }
}
