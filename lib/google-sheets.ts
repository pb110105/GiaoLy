import "server-only";
import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = process.env.GOOGLE_SHEET_NAME || "ACCOUNT";

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n");

if (!spreadsheetId) {
  throw new Error("Thiếu GOOGLE_SHEET_ID");
}

if (!clientEmail || !privateKey) {
  throw new Error(
    "Thiếu GOOGLE_CLIENT_EMAIL hoặc GOOGLE_PRIVATE_KEY",
  );
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

export { sheets, spreadsheetId, sheetName };