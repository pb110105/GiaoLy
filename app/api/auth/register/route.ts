import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  sheets,
  sheetName,
  spreadsheetId,
} from "@/lib/google-sheets";

export const runtime = "nodejs";

const registerSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0."),

  email: z
    .string()
    .trim()
    .email("Email không hợp lệ.")
    .transform((value) => value.toLowerCase())
    .refine(
      (value) => value.endsWith("@gmail.com"),
      "Vui lòng sử dụng địa chỉ Gmail.",
    ),

  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
    .max(72, "Mật khẩu không được vượt quá 72 ký tự.")
    .refine(
      (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
      "Mật khẩu phải chứa ít nhất một chữ cái và một chữ số.",
    ),
});

export async function POST(request: Request) {
  try {
    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const validationResult = registerSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Thông tin đăng ký không hợp lệ.",
          errors: validationResult.error.issues.map((issue) => ({
            field: issue.path[0],
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const { phone, email, password } = validationResult.data;

    // Đọc các tài khoản hiện có trong Sheet
    const accountResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:J`,
    });

    const accountRows = accountResponse.data.values ?? [];

    const phoneExists = accountRows.some(
      (row) => String(row[1] ?? "").trim() === phone,
    );

    if (phoneExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Số điện thoại đã được đăng ký.",
        },
        { status: 409 },
      );
    }

    const emailExists = accountRows.some(
      (row) => String(row[2] ?? "").trim().toLowerCase() === email,
    );

    if (emailExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Email đã được đăng ký.",
        },
        { status: 409 },
      );
    }

    // Không lưu mật khẩu gốc vào Google Sheet
    const passwordHash = await hash(password, 12);

    const accountId = randomUUID();
    const currentTime = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            accountId,      // A: id
            phone,          // B: phone
            email,          // C: email
            passwordHash,   // D: password_hash
            "teacher",      // E: role
            "pending",      // F: status
            "",             // G: reset_token_hash
            "",             // H: reset_token_expires_at
            currentTime,    // I: created_at
            currentTime,    // J: updated_at
          ],
        ],
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Đăng ký thành công. Tài khoản đang chờ được phê duyệt.",
        account: {
          id: accountId,
          phone,
          email,
          role: "teacher",
          status: "pending",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không thể đăng ký tài khoản. Vui lòng thử lại.",
      },
      { status: 500 },
    );
  }
}