import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
type AttendanceStatus =
  | "present"
  | "excused"
  | "absent";

type CcamsAttendanceRow = {
  ID: number;
  NGAYDIEMDANH: string;
  LOAI: number | null;
  GHICHU: string | null;
  NGAYTHUCHIEN: string | null;
  lophoc?: {
    MALOPHOC: number;
    TENLOPHOC: string;
    TENKHOI: string;
    TENNIENHOC: string;
  } | null;
  nguoidiemdanh?: string | null;
  nguoidiemdanh_kind?: string | null;
  is_vangcp?: boolean;
  COPHEP?: boolean;
  MAHOCVIEN: string | number;
  hoten: string;
  NGAYSINH?: string | null;
  MALOPHOC?: string | number | null;
  MAKHOI?: string | number | null;
};

type CcamsAttendanceResponse = {
  typeDD?: string;
  rows?: {
    data?: CcamsAttendanceRow[];
    page?: number;
    per_page?: number;
    total?: number;
    last_page?: number;
  };
};

function resolveAttendanceStatus(
  row: CcamsAttendanceRow,
): AttendanceStatus {
  if (!row.is_vangcp) {
    return "present";
  }

  return row.COPHEP
    ? "excused"
    : "absent";
}

const attendanceTypeLabels: Record<
  number,
  string
> = {
  1: "Thánh lễ",
  2: "Giáo lý",
  3: "Chầu Thánh Thể",
  4: "Xưng tội",
  5: "Thi đua/Khác",
};
export async function GET(request: NextRequest) {
  try {
    // Kiểm tra người dùng đã đăng nhập web của mình
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Bạn chưa đăng nhập.",
        },
        { status: 401 },
      );
    }

    try {
      await verifySessionToken(sessionToken);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Phiên đăng nhập không hợp lệ.",
        },
        { status: 401 },
      );
    }

    // Lấy cấu hình bí mật từ .env.local
    const baseUrl = process.env.CCAMS_BASE_URL;
    const lookupPhone =
      process.env.CCAMS_LOOKUP_PHONE;

    if (!baseUrl || !lookupPhone) {
      return NextResponse.json(
        {
          success: false,
          message: "Chưa cấu hình kết nối CCAMS.",
        },
        { status: 500 },
      );
    }

    // Nhận bộ lọc từ giao diện
    const date = clean(
      request.nextUrl.searchParams.get("date"),
    );

    const attendanceType = clean(
      request.nextUrl.searchParams.get("loai"),
    );

    const schoolYearId = clean(
      request.nextUrl.searchParams.get("nienhoc"),
    );

    const externalClassId = clean(
      request.nextUrl.searchParams.get("khoi_lop"),
    );

    const search = clean(
      request.nextUrl.searchParams.get("search"),
    );

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          message: "Ngày điểm danh không hợp lệ.",
        },
        { status: 400 },
      );
    }

    if (
      !/^(all|[1-5]|v_all|v_[1-5])$/.test(
        attendanceType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Loại điểm danh không hợp lệ.",
        },
        { status: 400 },
      );
    }

    if (!/^\d+$/.test(schoolYearId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Mã niên học không hợp lệ.",
        },
        { status: 400 },
      );
    }

    if (
      !/^(all|k_\d+|l_\d+)$/.test(externalClassId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Mã lớp CCAMS không hợp lệ.",
        },
        { status: 400 },
      );
    }

    // Tạo URL CCAMS ở máy chủ
    const normalizedBaseUrl =
    baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`;

    const ccamsUrl = new URL(
      "public/lookup/glv/diemdanh",
      normalizedBaseUrl,
    );

    ccamsUrl.searchParams.set(
      "phone",
      lookupPhone,
    );

    ccamsUrl.searchParams.set("date", date);
    ccamsUrl.searchParams.set(
      "loai",
      attendanceType,
    );

    ccamsUrl.searchParams.set(
      "nienhoc",
      schoolYearId,
    );

    ccamsUrl.searchParams.set(
      "khoi_lop",
      externalClassId,
    );

    if (search) {
      ccamsUrl.searchParams.set("search", search);
    }
    ccamsUrl.searchParams.set("page", "1");

    const ccamsResponse = await fetch(ccamsUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const responseText =
      await ccamsResponse.text();

        let sourceData: CcamsAttendanceResponse;

    try {
      sourceData = JSON.parse(
        responseText,
      ) as CcamsAttendanceResponse;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "CCAMS không trả về dữ liệu JSON hợp lệ.",
          debug: {
            sourceStatus: ccamsResponse.status,
            responsePath: new URL(
              ccamsResponse.url,
            ).pathname,
            contentType:
              ccamsResponse.headers.get(
                "content-type",
              ),
            responsePreview: responseText
              .slice(0, 300)
              .replace(/\s+/g, " "),
          },
        },
        { status: 502 },
      );
    }

    if (!ccamsResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            "CCAMS từ chối yêu cầu tra cứu.",
          sourceStatus: ccamsResponse.status,
        },
        { status: 502 },
      );
    }
        const rawRows =
      sourceData.rows?.data ?? [];

    const records = rawRows.map((row) => ({
      sourceId: String(row.ID),

      externalStudentCode: String(
        row.MAHOCVIEN ?? "",
      ),

      fullName: clean(row.hoten),
      birthDate: clean(row.NGAYSINH),

      attendanceDate: clean(
        row.NGAYDIEMDANH,
      ),

      attendanceType: row.LOAI,

      attendanceTypeLabel:
        row.LOAI !== null
          ? attendanceTypeLabels[row.LOAI] ??
            "Khác"
          : "Khác",

      status: resolveAttendanceStatus(row),
      note: clean(row.GHICHU),
      markedBy: clean(row.nguoidiemdanh),
      markedAt: clean(row.NGAYTHUCHIEN),

      externalClassId: row.MALOPHOC
        ? `l_${row.MALOPHOC}`
        : "",

      className: clean(
        row.lophoc?.TENLOPHOC,
      ),

      gradeLevel: clean(
        row.lophoc?.TENKHOI,
      ),

      schoolYear: clean(
        row.lophoc?.TENNIENHOC,
      ),
    }));

    return NextResponse.json(
      {
        success: true,
        filters: {
          date,
          attendanceType,
          schoolYearId,
          externalClassId,
          search,
        },
        summary: {
  total:
    sourceData.rows?.total ??
    records.length,
  page:
    sourceData.rows?.page ?? 1,
  lastPage:
    sourceData.rows?.last_page ?? 1,
},
records,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("CCAMS API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể lấy dữ liệu từ CCAMS.",
      },
      { status: 500 },
    );
  }
}
