import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAccountRole } from "@/lib/access-control";
import {
  sheets,
  sheetName,
  spreadsheetId,
} from "@/lib/google-sheets";

import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/session";

export const runtime = "nodejs";

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^0\d{9}$/,
      "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.",
    ),

  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu."),
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

    const validationResult = loginSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            validationResult.error.issues[0]?.message ||
            "Thông tin đăng nhập không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const { phone, password } = validationResult.data;

    const sheetResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A2:J`,
      });

    const rows = sheetResponse.data.values ?? [];

    const accountRow = rows.find(
      (row) => String(row[1] ?? "").trim() === phone,
    );

    if (!accountRow) {
      return NextResponse.json(
        {
          success: false,
          message: "Số điện thoại hoặc mật khẩu không đúng.",
        },
        { status: 401 },
      );
    }

    const account = {
      id: String(accountRow[0] ?? "").trim(),
      phone: String(accountRow[1] ?? "").trim(),
      email: String(accountRow[2] ?? "")
        .trim()
        .toLowerCase(),
      passwordHash: String(accountRow[3] ?? "").trim(),
      role: String(accountRow[4] ?? "")
        .trim()
        .toLowerCase(),
      status: String(accountRow[5] ?? "")
        .trim()
        .toLowerCase(),
    };

    const passwordMatches = await compare(
      password,
      account.passwordHash,
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Số điện thoại hoặc mật khẩu không đúng.",
        },
        { status: 401 },
      );
    }

    if (!isAccountRole(account.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Tài khoản không có vai trò hợp lệ.",
        },
        { status: 403 },
      );
    }

    if (account.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tài khoản chưa được phê duyệt hoặc đã bị khóa.",
        },
        { status: 403 },
      );
    }

    const sessionToken = await createSessionToken({
      id: account.id,
      phone: account.phone,
      email: account.email,
      role: account.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập thành công.",
      account: {
        id: account.id,
        phone: account.phone,
        email: account.email,
        role: account.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không thể đăng nhập. Vui lòng thử lại.",
      },
      { status: 500 },
    );
  }
}