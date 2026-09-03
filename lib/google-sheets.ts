import "server-only";
import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = process.env.GOOGLE_SHEET_NAME || "ACCOUNT";
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!spreadsheetId) {
  throw new Error("Thiếu GOOGLE_SHEET_ID trong .env.local");
}

if (!credentialsPath) {
  throw new Error(
    "Thiếu GOOGLE_APPLICATION_CREDENTIALS trong .env.local",
  );
}

const auth = new google.auth.GoogleAuth({
  keyFile: credentialsPath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

export { sheets, spreadsheetId, sheetName };