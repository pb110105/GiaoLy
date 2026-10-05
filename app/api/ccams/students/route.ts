import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Bạn chưa đăng nhập.",
        },
        { status: 401 },
      );
    }

    try {
      await verifySessionToken(token);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Phiên đăng nhập không hợp lệ.",
        },
        { status: 401 },
      );
    }

    const baseUrl = process.env.CCAMS_BASE_URL;
    const phone = process.env.CCAMS_LOOKUP_PHONE;

    if (!baseUrl || !phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Chưa cấu hình kết nối CCAMS.",
        },
        { status: 500 },
      );
    }

    const search =
      request.nextUrl.searchParams.get("search")
        ?.trim() ?? "";

    const page =
      request.nextUrl.searchParams.get("page") ?? "1";

    if (!search || search.length > 120) {
      return NextResponse.json(
        {
          success: false,
          message: "Nhập từ khóa tìm kiếm từ 1 đến 120 ký tự.",
        },
        { status: 400 },
      );
    }

    if (
      !/^[1-9]\d*$/.test(page) ||
      !Number.isSafeInteger(Number(page))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Số trang không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const normalizedBaseUrl = baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`;

    const url = new URL(
      "public/lookup/glv/hocvien",
      normalizedBaseUrl,
    );

    url.searchParams.set("phone", phone);
    url.searchParams.set("search", search);
    url.searchParams.set("page", page);

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "CCAMS từ chối yêu cầu tìm học viên.",
          sourceStatus: response.status,
        },
        { status: 502 },
      );
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "CCAMS không trả về JSON hợp lệ.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("CCAMS STUDENTS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không thể lấy danh sách học viên CCAMS.",
      },
      { status: 502 },
    );
  }
}