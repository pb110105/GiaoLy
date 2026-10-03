import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
};

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
        { status: 401, headers: responseHeaders },
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
        { status: 401, headers: responseHeaders },
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
        { status: 500, headers: responseHeaders },
      );
    }

    const schoolYearId =
      request.nextUrl.searchParams.get("nienhoc")?.trim() ?? "";

    if (schoolYearId && !/^\d+$/.test(schoolYearId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Mã niên học không hợp lệ.",
        },
        { status: 400, headers: responseHeaders },
      );
    }

    const normalizedBaseUrl = baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`;

    const url = new URL(
      "public/lookup/glv/meta",
      normalizedBaseUrl,
    );

    url.searchParams.set("phone", phone);

    if (schoolYearId) {
      url.searchParams.set("nienhoc", schoolYearId);
    }

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Không lấy được danh sách bộ lọc từ CCAMS.",
          sourceStatus: response.status,
        },
        { status: 502, headers: responseHeaders },
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
        { status: 502, headers: responseHeaders },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error("CCAMS META ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không thể tải bộ lọc CCAMS.",
      },
      { status: 502, headers: responseHeaders },
    );
  }
}