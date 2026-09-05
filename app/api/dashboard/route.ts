import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AccessError,
  resolveAccessScope,
} from "@/lib/access-control";
import {
  sheets,
  spreadsheetId,
} from "@/lib/google-sheets";
import {
  LogOut,
} from "lucide-react";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  try {
    // 1. Lấy JWT từ cookie
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

    // 2. Kiểm tra JWT
    let session;

    try {
      session = await verifySessionToken(sessionToken);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        },
        { status: 401 },
      );
    }

    const accountId = cell(session.sub);

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Phiên đăng nhập thiếu mã tài khoản.",
        },
        { status: 401 },
      );
    }

    // 3. Đọc các tab trong một lần gọi Google Sheets API
    const sheetResponse =
      await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [
          "ACCOUNT!A2:J",
          "TEACHER!A2:F",
          "CLASS!A2:J",
          "TEACHER_CLASS!A2:G",
          "STUDENT!A2:K",
        ],
      });

    const valueRanges =
      sheetResponse.data.valueRanges ?? [];

    const accountRows =
      valueRanges[0]?.values ?? [];

    const teacherRows =
      valueRanges[1]?.values ?? [];

    const classRows =
      valueRanges[2]?.values ?? [];

    const teacherClassRows =
      valueRanges[3]?.values ?? [];

    const studentRows =
      valueRanges[4]?.values ?? [];

    // 4. Kiểm tra tài khoản vẫn còn active
    // 4. Xác định quyền của tài khoản
    const access = resolveAccessScope(accountId, {
      accounts: accountRows,
      teachers: teacherRows,
      assignments: teacherClassRows,
    });

    /*
     * Tạo danh sách tên GLV phụ trách từng lớp.
     * Dữ liệu này dùng khi admin xem toàn bộ lớp.
     */
    const teacherNameById = new Map(
      teacherRows
        .filter(
          (row) =>
            cell(row[3]).toLowerCase() === "active",
        )
        .map((row) => [
          cell(row[0]),
          cell(row[2]),
        ]),
    );

    const teacherNamesByClassId =
      new Map<string, string[]>();

    for (const assignment of teacherClassRows) {
      if (
        cell(assignment[4]).toLowerCase() !== "active"
      ) {
        continue;
      }

      const teacherId = cell(assignment[1]);
      const classId = cell(assignment[2]);
      const teacherName =
        teacherNameById.get(teacherId);

      if (!classId || !teacherName) {
        continue;
      }

      const currentNames =
        teacherNamesByClassId.get(classId) ?? [];

      if (!currentNames.includes(teacherName)) {
        currentNames.push(teacherName);
      }

      teacherNamesByClassId.set(
        classId,
        currentNames,
      );
    }

    /*
     * Admin được lấy toàn bộ lớp active.
     * Teacher chỉ lấy lớp được phân công.
     */
    const accessibleClasses = classRows
      .filter((row) => {
        const classId = cell(row[0]);
        const isActive =
          cell(row[7]).toLowerCase() === "active";

        return (
          isActive &&
          (
            access.isAdmin ||
            access.assignedClassIds.has(classId)
          )
        );
      })
      .map((row) => {
        const classId = cell(row[0]);

        return {
          id: classId,
          classCode: cell(row[1]),
          className: cell(row[2]),
          gradeLevel: cell(row[3]),
          schoolYear: cell(row[4]),
          schedule: cell(row[5]),
          room: cell(row[6]),
          status: cell(row[7]),

          assignmentRole: access.isAdmin
            ? "admin"
            : access.assignmentRoleByClass.get(
                classId,
              ) ?? "",

          teacherNames:
            teacherNamesByClassId.get(classId) ?? [],
        };
      });

    const accessibleClassIds = new Set(
      accessibleClasses.map(
        (classItem) => classItem.id,
      ),
    );

    /*
     * Chỉ trả về học viên thuộc những lớp
     * mà tài khoản được quyền truy cập.
     */
    const accessibleStudents = studentRows
      .filter(
        (row) =>
          accessibleClassIds.has(cell(row[3])) &&
          cell(row[8]).toLowerCase() === "studying",
      )
      .map((row) => ({
        id: cell(row[0]),
        studentCode: cell(row[1]),
        fullName: cell(row[2]),
        classId: cell(row[3]),
        birthDate: cell(row[4]),
        gender: cell(row[5]),
        guardianName: cell(row[6]),
        guardianPhone: cell(row[7]),
        status: cell(row[8]),
      }));

    return NextResponse.json(
      {
        success: true,

        /*
         * Tạm giữ tên thuộc tính teacher để giao diện
         * hiện tại không bị lỗi. Ta sẽ đổi thành viewer sau.
         */
        teacher: {
          id:
            Array.from(access.teacherIds)[0] ?? "",
          accountId: access.accountId,
          fullName: access.displayName,
          phone: access.phone,
          email: access.email,
          role: access.role,
        },

        summary: {
          classCount: accessibleClasses.length,
          studentCount: accessibleStudents.length,
        },

        classes: accessibleClasses,
        students: accessibleStudents,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
  if (error instanceof AccessError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      {
        status: error.status,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  console.error("DASHBOARD API ERROR:", error);

  return NextResponse.json(
    {
      success: false,
      message:
        "Không thể tải dữ liệu dashboard. Vui lòng thử lại.",
    },
    {
      status: 500,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
}
