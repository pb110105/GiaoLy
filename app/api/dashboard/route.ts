import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  sheets,
  spreadsheetId,
} from "@/lib/google-sheets";

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
    const accountRow = accountRows.find(
      (row) => cell(row[0]) === accountId,
    );

    if (!accountRow) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy tài khoản.",
        },
        { status: 403 },
      );
    }

    const accountRole = cell(accountRow[4]).toLowerCase();
    const accountStatus = cell(accountRow[5]).toLowerCase();

    if (
      accountRole !== "teacher" ||
      accountStatus !== "active"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tài khoản không có quyền truy cập hoặc đã bị khóa.",
        },
        { status: 403 },
      );
    }

    // 5. Tìm hồ sơ GLV qua account_id
    const teacherRow = teacherRows.find(
      (row) =>
        cell(row[1]) === accountId &&
        cell(row[3]).toLowerCase() === "active",
    );

    if (!teacherRow) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tài khoản chưa được liên kết với hồ sơ GLV.",
        },
        { status: 403 },
      );
    }

    const teacherId = cell(teacherRow[0]);

    // 6. Tìm những lớp được phân công cho GLV
    const activeAssignments = teacherClassRows.filter(
      (row) =>
        cell(row[1]) === teacherId &&
        cell(row[4]).toLowerCase() === "active",
    );

    const assignedClassIds = new Set(
      activeAssignments
        .map((row) => cell(row[2]))
        .filter(Boolean),
    );

    const assignmentRoleByClass = new Map(
      activeAssignments.map((row) => [
        cell(row[2]),
        cell(row[3]),
      ]),
    );

    // 7. Chỉ lấy lớp thuộc GLV đang đăng nhập
    const assignedClasses = classRows
      .filter(
        (row) =>
          assignedClassIds.has(cell(row[0])) &&
          cell(row[7]).toLowerCase() === "active",
      )
      .map((row) => ({
        id: cell(row[0]),
        classCode: cell(row[1]),
        className: cell(row[2]),
        gradeLevel: cell(row[3]),
        schoolYear: cell(row[4]),
        schedule: cell(row[5]),
        room: cell(row[6]),
        status: cell(row[7]),
        assignmentRole:
          assignmentRoleByClass.get(cell(row[0])) ?? "",
      }));

    const validClassIds = new Set(
      assignedClasses.map((classItem) => classItem.id),
    );

    // 8. Chỉ lấy học viên thuộc các lớp được phân công
    const assignedStudents = studentRows
      .filter(
        (row) =>
          validClassIds.has(cell(row[3])) &&
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
        teacher: {
          id: teacherId,
          accountId,
          fullName: cell(teacherRow[2]),
          phone: cell(accountRow[1]),
          email: cell(accountRow[2]),
          role: accountRole,
        },
        summary: {
          classCount: assignedClasses.length,
          studentCount: assignedStudents.length,
        },
        classes: assignedClasses,
        students: assignedStudents,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("DASHBOARD API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể tải dữ liệu dashboard. Vui lòng thử lại.",
      },
      { status: 500 },
    );
  }
}