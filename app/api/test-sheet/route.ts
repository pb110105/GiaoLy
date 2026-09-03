import { NextResponse } from "next/server";
import {
  sheets,
  spreadsheetId,
  sheetName,
} from "@/lib/google-sheets";

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:J5`,
    });

    const rows = response.data.values ?? [];

    return NextResponse.json({
      success: true,
      message: "Kết nối Google Sheet thành công.",
      sheetName,
      rowCount: rows.length,
      headers: rows[0] ?? [],
    });
  } catch (error: unknown) {
  const message =
    error instanceof Error ? error.message : "Lỗi không xác định";

  console.error("GOOGLE SHEET ERROR:", error);

  return NextResponse.json(
    {
      success: false,
      message: "Không thể kết nối Google Sheet.",
      error: message,
    },
    { status: 500 },
  );
}
}