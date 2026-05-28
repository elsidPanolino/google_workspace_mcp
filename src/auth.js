import "dotenv/config";
import { google } from "googleapis";
import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import open from "open";

// Full Google Workspace scope set. If you trim the services you register in
// index.js, you can trim the matching scopes here to shrink the consent screen.
const SCOPES = [
  // Apps Script
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.deployments",
  "https://www.googleapis.com/auth/script.processes",
  // Drive + Sheets
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  // Calendar
  "https://www.googleapis.com/auth/calendar",
  // Gmail (restricted scopes — unverified-app warning until the app is verified)
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  // Docs + Slides
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations",
];

const TOKEN_PATH = process.env.TOKEN_PATH || "./tokens/google-tokens.json";
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback";

function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required"
    );
    process.exit(1);
  }

  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

function saveTokens(tokens) {
  const dir = dirname(TOKEN_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

function loadTokens() {
  if (!existsSync(TOKEN_PATH)) return null;
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
}

/**
 * Run the interactive OAuth2 consent flow in a browser.
 * Starts a temporary HTTP server to catch the redirect.
 */
async function interactiveAuth(oauth2Client) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost:3000");
        if (url.pathname !== "/oauth2callback") return;

        const code = url.searchParams.get("code");
        if (!code) {
          res.end("No code received.");
          reject(new Error("No authorization code received"));
          return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        saveTokens(tokens);

        res.end(
          "Authentication successful! You can close this tab and return to the terminal."
        );
        server.close();
        resolve(oauth2Client);
      } catch (err) {
        res.end("Authentication failed.");
        server.close();
        reject(err);
      }
    });

    server.listen(3000, () => {
      console.log("Opening browser for Google authentication...");
      console.log("If the browser doesn't open, visit:", authUrl);
      open(authUrl);
    });
  });
}

/**
 * Get an authenticated OAuth2 client.
 * Uses saved tokens if available, otherwise requires interactive auth first.
 */
export async function getAuthClient() {
  const oauth2Client = createOAuth2Client();

  // Auto-save refreshed tokens
  oauth2Client.on("tokens", (tokens) => {
    const existing = loadTokens() || {};
    saveTokens({ ...existing, ...tokens });
  });

  const tokens = loadTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }

  throw new Error(
    "Not authenticated. Run `npm run auth` first to complete the OAuth2 flow."
  );
}

// When run directly: npm run auth
if (
  process.argv[1] &&
  (process.argv[1].endsWith("auth.js") || process.argv[1].endsWith("auth"))
) {
  const oauth2Client = createOAuth2Client();
  await interactiveAuth(oauth2Client);
  console.log("Tokens saved to", TOKEN_PATH);
  process.exit(0);
}
