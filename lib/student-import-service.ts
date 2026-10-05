import { createHash } from "node:crypto";

import {
  authorizeImport,
  cell,
  flagExistingCodes,
  ImportError,
  STUDENT_HEADERS,
  type ImportRow,
  type ImportPreview,
  type ImportSaved,
} from "./student-import";

export type ImportInput = {
  action: "preview" | "commit";
  accountId: string;
  classId: string;
  schoolYear: string;
  fingerprint: string;
  rows: ImportRow[];
};

export type ImportStore = {
  loadTables: () => Promise<unknown[][][]>;
  append: (rows: string[][]) => Promise<void>;
  now?: () => string;
};

// Cùng tài khoản, lớp và file sẽ tạo cùng bộ ID.
// Dùng để nhận diện lần thử lại sau khi mất kết nối.
export function importRecords(
  input: ImportInput,
  now: string,
): string[][] {
  const batch = createHash("sha256")
    .update(
      JSON.stringify([
        input.accountId,
        input.classId,
        input.schoolYear,
        input.fingerprint,
      ]),
    )
    .digest("hex")
    .slice(0, 32);

  return input.rows.map((row, index) => [
    `IMP-${batch}-${index + 1}`,
    row.studentCode,
    row.fullName,
    input.classId,
    row.birthDate,
    row.gender,
    row.guardianName,
    row.guardianPhone,
    "studying",
    now,
    now,
    "",
  ]);
}

export async function runStudentImport(
  input: ImportInput,
  store: ImportStore,
): Promise<ImportPreview | ImportSaved> {
  // Đọc lại dữ liệu trong cả bước xem trước và xác nhận.
  const tables = await store.loadTables();

  // Kiểm tra quyền phụ trách lớp.
  const target = authorizeImport(
    input.accountId,
    input.classId,
    input.schoolYear,
    tables,
  );

  // Bảng thứ năm là STUDENT, bao gồm hàng tiêu đề.
  const studentTable = tables[4] ?? [];

  const invalidHeader = STUDENT_HEADERS.some(
    (header, index) =>
      cell(studentTable[0]?.[index]).toLowerCase() !== header,
  );

  if (invalidHeader) {
    throw new ImportError(
      "Cấu trúc bảng học viên chưa đúng. Hãy kiểm tra hàng tiêu đề tab STUDENT.",
      500,
      "SHEET_SCHEMA",
    );
  }

  const existing = studentTable.slice(1);

  const records = importRecords(
    input,
    store.now?.() ?? new Date().toISOString(),
  );

  const existingById = new Map(
    existing.map((row) => [cell(row[0]), row]),
  );

  // Kiểm tra lô này đã được lưu đầy đủ hay chưa.
  // Không so sánh created_at/updated_at vì lần thử lại có thời gian khác.
  const alreadySaved =
    records.length > 0 &&
    input.rows.every((row) => row.issues.length === 0) &&
    records.every((record) => {
      const found = existingById.get(record[0]);

      return (
        found !== undefined &&
        record
          .slice(0, 9)
          .every((value, index) => cell(found[index]) === value)
      );
    });

  if (input.action === "commit" && alreadySaved) {
    return {
      success: true,
      phase: "saved",
      count: records.length,
      alreadyImported: true,
      classId: input.classId,
      schoolYear: input.schoolYear,
    };
  }

  // Kiểm tra mã trùng với dữ liệu hiện có.
  const rows = flagExistingCodes(input.rows, existing);

  const invalidCount = rows.filter(
    (row) => row.issues.length > 0,
  ).length;

  const report: ImportPreview = {
    success: true,
    phase: "preview",
    ...target,
    fingerprint: input.fingerprint,
    rows,
    total: rows.length,
    invalidCount,
    canImport: rows.length > 0 && invalidCount === 0,
  };

  // Chỉ xem trước hoặc còn dòng lỗi thì trả kết quả kiểm tra.
  if (input.action === "preview" || !report.canImport) {
    return report;
  }

  // Ghi toàn bộ danh sách trong một lần.
  try {
    await store.append(records);
  } catch {
    throw new ImportError(
      "Chưa xác nhận được kết quả lưu. Giữ nguyên file và bấm Xác nhận nhập lần nữa để kiểm tra, tránh tạo bản nhập mới.",
      503,
      "SAVE_UNCERTAIN",
    );
  }

  return {
    success: true,
    phase: "saved",
    count: records.length,
    alreadyImported: false,
    classId: input.classId,
    schoolYear: input.schoolYear,
  };
}

// Xếp hàng các lần xác nhận trong cùng một tiến trình Node.js.
export async function serializeStudentImport<T>(
  work: () => Promise<T>,
): Promise<T> {
  const state = globalThis as typeof globalThis & {
    __giaolyStudentImportQueue?: Promise<void>;
  };

  const previous =
    state.__giaolyStudentImportQueue ?? Promise.resolve();

  let release!: () => void;

  state.__giaolyStudentImportQueue = new Promise<void>(
    (resolve) => {
      release = resolve;
    },
  );

  await previous;

  try {
    return await work();
  } finally {
    release();
  }
}