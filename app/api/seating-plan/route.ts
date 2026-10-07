import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { sheets, spreadsheetId } from "@/lib/google-sheets";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";
import {
  AccessError,
  accessCell,
  resolveAccessScope,
  canAccessClass,
} from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Seats = (string | null)[][];

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validateSeats(value: unknown): Seats {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 30
  ) {
    throw new AccessError("Số hàng phải từ 1 đến 30.", 400);
  }

  const columns = Array.isArray(value[0])
    ? value[0].length
    : 0;

  if (columns < 1 || columns > 20) {
    throw new AccessError("Số cột phải từ 1 đến 20.", 400);
  }

  const usedIds = new Set<string>();

  for (const row of value) {
    if (!Array.isArray(row) || row.length !== columns) {
      throw new AccessError("Sơ đồ phải có đủ hàng và cột.", 400);
    }

    for (const id of row) {
      if (id === null) continue;

      if (
        typeof id !== "string" ||
        !id.trim() ||
        id.length > 100 ||
        usedIds.has(id)
      ) {
        throw new AccessError(
          "ID học viên không hợp lệ hoặc bị xếp trùng.",
          400,
        );
      }

      usedIds.add(id);
    }
  }

  return value as Seats;
}

async function loadContext(classId: string, schoolYear: string) {
  if (
    !classId ||
    classId.length > 100 ||
    !schoolYear ||
    schoolYear.length > 40
  ) {
    throw new AccessError("Lớp hoặc niên học không hợp lệ.", 400);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    throw new AccessError("Bạn chưa đăng nhập.", 401);
  }

  let accountId = "";

  try {
    const session = await verifySessionToken(token);
    accountId = accessCell(session.sub);
  } catch {
    throw new AccessError(
      "Phiên đăng nhập hết hạn. Hãy đăng nhập lại.",
      401,
    );
  }

  if (!accountId) {
    throw new AccessError("Phiên đăng nhập không hợp lệ.", 401);
  }

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      "ACCOUNT!A2:J",
      "TEACHER!A2:F",
      "TEACHER_CLASS!A2:G",
      "CLASS!A2:J",
      "STUDENT!A2:L",
      "SEATING_PLAN!A2:F",
    ],
  });

  const tables = (response.data.valueRanges ?? []).map(
    (range) => range.values ?? [],
  );

  const scope = resolveAccessScope(accountId, {
    accounts: tables[0],
    teachers: tables[1],
    assignments: tables[2],
  });

  if (!canAccessClass(scope, classId)) {
    throw new AccessError("Bạn không có quyền thao tác lớp này.");
  }

  const classRow = tables[3].find(
    (row) =>
      accessCell(row[0]) === classId &&
      accessCell(row[4]) === schoolYear,
  );

  if (!classRow) {
    throw new AccessError(
      "Không tìm thấy lớp trong niên học đã chọn.",
      404,
    );
  }

  const studentIds = new Set(
    tables[4]
      .filter((row) => accessCell(row[3]) === classId)
      .map((row) => accessCell(row[0]))
      .filter(Boolean),
  );

  const matchingRows = tables[5]
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(
      ({ row }) =>
        accessCell(row[0]) === classId &&
        accessCell(row[1]) === schoolYear,
    );

  if (matchingRows.length > 1) {
    throw new AccessError(
      "Có nhiều sơ đồ trùng lớp và niên học trong Sheets. Cần giữ lại một dòng.",
      409,
    );
  }

  const saved = matchingRows[0];
  const revision = saved ? Number(saved.row[5]) : 0;

  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (saved && revision < 1)
  ) {
    throw new AccessError(
      "Revision của sơ đồ trong Sheets không hợp lệ.",
      409,
    );
  }

  return { accountId, studentIds, saved, revision };
}

function handleError(error: unknown) {
  if (error instanceof AccessError) {
    return reply(
      { success: false, message: error.message },
      error.status,
    );
  }

  console.error(
    "SEATING_PLAN_FAILED",
    error instanceof Error ? error.name : "UnknownError",
  );

  return reply(
    {
      success: false,
      message:
        "Không thể xử lý sơ đồ. Kiểm tra tab SEATING_PLAN và thử lại.",
    },
    500,
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const classId = params.get("classId")?.trim() ?? "";
    const schoolYear = params.get("schoolYear")?.trim() ?? "";

    const context = await loadContext(classId, schoolYear);

    let seats: Seats | null = null;

    if (context.saved) {
      seats = validateSeats(
        JSON.parse(accessCell(context.saved.row[2])),
      );

      // Học viên đã chuyển khỏi lớp được gỡ khỏi sơ đồ khi tải.
      seats = seats.map((row) =>
        row.map((id) =>
          id && context.studentIds.has(id) ? id : null,
        ),
      );
    }

    return reply({
      success: true,
      seats,
      revision: context.revision,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");

    if (
      request.headers.get("x-giaoly-seating") !== "1" ||
      (origin && origin !== new URL(request.url).origin)
    ) {
      throw new AccessError("Yêu cầu không hợp lệ.", 403);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      throw new AccessError("Dữ liệu gửi lên không hợp lệ.", 400);
    }

    if (!body || typeof body !== "object") {
      throw new AccessError("Dữ liệu gửi lên không hợp lệ.", 400);
    }

    const classId = accessCell(body.classId);
    const schoolYear = accessCell(body.schoolYear);
    const seats = validateSeats(body.seats);

    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0
    ) {
      throw new AccessError("Revision không hợp lệ.", 400);
    }

    const context = await loadContext(classId, schoolYear);

    if (body.revision !== context.revision) {
      throw new AccessError(
        "Sơ đồ đã được cập nhật ở phiên khác. Tải lại sơ đồ trước khi lưu.",
        409,
      );
    }

    for (const id of seats.flat()) {
      if (id && !context.studentIds.has(id)) {
        throw new AccessError(
          "Sơ đồ chứa học viên không thuộc lớp này.",
          400,
        );
      }
    }

    const revision = context.revision + 1;
    const values = [[
      classId,
      schoolYear,
      JSON.stringify(seats),
      new Date().toISOString(),
      context.accountId,
      revision,
    ]];

    if (context.saved) {
      await sheets.spreadsheets.values.update(
        {
          spreadsheetId,
          range:
            `SEATING_PLAN!A${context.saved.sheetRow}:F${context.saved.sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values },
        },
        { retry: false, timeout: 20000 },
      );
    } else {
      await sheets.spreadsheets.values.append(
        {
          spreadsheetId,
          range: "SEATING_PLAN!A:F",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        },
        { retry: false, timeout: 20000 },
      );
    }

    return reply({ success: true, revision });
  } catch (error) {
    return handleError(error);
  }
}