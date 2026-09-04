export const IMPORT_HEADERS = [
  "student_code",
  "full_name",
  "birth_date",
  "gender",
  "guardian_name",
  "guardian_phone",
] as const;

export const STUDENT_HEADERS = [
  "id",
  "student_code",
  "full_name",
  "class_id",
  "birth_date",
  "gender",
  "guardian_name",
  "guardian_phone",
  "status",
  "created_at",
  "updated_at",
] as const;

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type ImportRow = {
  rowNumber: number;
  studentCode: string;
  fullName: string;
  birthDate: string;
  gender: string;
  guardianName: string;
  guardianPhone: string;
  issues: string[];
};

export type ImportPreview = {
  success: true;
  phase: "preview";
  classId: string;
  className: string;
  schoolYear: string;
  fingerprint: string;
  rows: ImportRow[];
  total: number;
  invalidCount: number;
  canImport: boolean;
};

export type ImportSaved = {
  success: true;
  phase: "saved";
  count: number;
  alreadyImported: boolean;
  classId: string;
  schoolYear: string;
};

export type ImportResponse =
  | ImportPreview
  | ImportSaved
  | {
      success: false;
      message: string;
      code?: string;
      rows?: ImportRow[];
    };

export class ImportError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_IMPORT",
  ) {
    super(message);
  }
}

export const cell = (value: unknown) =>
  String(value ?? "").trim();

const codeKey = (value: unknown) =>
  cell(value).toUpperCase();

// Nhận ngày Excel, yyyy-mm-dd hoặc dd/mm/yyyy.
function normalizeBirthDate(value: unknown, today: string) {
  let iso = "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    iso = value.toISOString().slice(0, 10);
  } else if (typeof value === "string") {
    const input = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      iso = input;
    } else {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);

      if (match) {
        iso = [
          match[3],
          match[2].padStart(2, "0"),
          match[1].padStart(2, "0"),
        ].join("-");
      }
    }
  }

  if (!iso) return "";

  const date = new Date(`${iso}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso ||
    iso < "1900-01-01" ||
    iso > today
  ) {
    return "";
  }

  return iso;
}

// Kiểm tra nội dung từng dòng trong Excel.
export function validateImportRows(
  table: unknown[][],
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date()),
): ImportRow[] {
  const header = (table[0] ?? []).map((value) =>
    cell(value).toLowerCase(),
  );

  if (
    header.length !== IMPORT_HEADERS.length ||
    new Set(header).size !== header.length ||
    IMPORT_HEADERS.some((name) => !header.includes(name))
  ) {
    throw new ImportError(
      `Hàng 1 phải có đúng 6 cột: ${IMPORT_HEADERS.join(", ")}.`,
    );
  }

  const genderNames: Record<string, string> = {
    nam: "male",
    male: "male",
    nữ: "female",
    nu: "female",
    female: "female",
    khác: "other",
    khac: "other",
    other: "other",
  };

  const rows: ImportRow[] = [];

  for (let index = 1; index < table.length; index++) {
    const values = table[index];

    // Bỏ qua dòng trống.
    if (values.every((value) => value == null || cell(value) === "")) {
      continue;
    }

    if (rows.length >= MAX_IMPORT_ROWS) {
      throw new ImportError(
        `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} học viên.`,
      );
    }

    const get = (name: (typeof IMPORT_HEADERS)[number]) =>
      values[header.indexOf(name)];

    const issues: string[] = [];
    const studentCode = codeKey(get("student_code"));
    const fullName = cell(get("full_name")).replace(/\s+/g, " ");
    const guardianName = cell(get("guardian_name")).replace(/\s+/g, " ");
    const gender = genderNames[cell(get("gender")).toLowerCase()] ?? "";
    const birthDate = normalizeBirthDate(get("birth_date"), today);
    const phoneValue = get("guardian_phone");
    const guardianPhone = cell(phoneValue).replace(/[\s().-]/g, "");

    if (
      typeof get("student_code") !== "string" ||
      !/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(studentCode)
    ) {
      issues.push(
        "Mã học viên phải là Text, từ 1–40 ký tự A–Z, 0–9 hoặc . _ / -.",
      );
    }

    if (
      typeof get("full_name") !== "string" ||
      !fullName ||
      fullName.length > 120
    ) {
      issues.push("Họ tên học viên bắt buộc, tối đa 120 ký tự.");
    }

    if (!birthDate) {
      issues.push(
        "Ngày sinh không hợp lệ. Dùng ngày Excel, yyyy-mm-dd hoặc dd/mm/yyyy; không nhập ngày tương lai.",
      );
    }

    if (!gender) {
      issues.push("Giới tính phải là Nam, Nữ hoặc Khác.");
    }

    if (
      typeof get("guardian_name") !== "string" ||
      !guardianName ||
      guardianName.length > 120
    ) {
      issues.push("Họ tên phụ huynh bắt buộc, tối đa 120 ký tự.");
    }

    if (
      typeof phoneValue !== "string" ||
      !/^(?:0\d{9,10}|\+[1-9]\d{8,14})$/.test(guardianPhone)
    ) {
      issues.push(
        "Điện thoại phải là Text và giữ số 0 đầu, hoặc dùng +mã quốc gia.",
      );
    }

    if (
      values.slice(header.length).some(
        (value) => value != null && cell(value),
      )
    ) {
      issues.push("Có dữ liệu ngoài 6 cột của file mẫu.");
    }

    rows.push({
      rowNumber: index + 1,
      studentCode,
      fullName,
      birthDate: birthDate || cell(get("birth_date")).slice(0, 32),
      gender: gender || cell(get("gender")),
      guardianName,
      guardianPhone,
      issues,
    });
  }

  if (!rows.length) {
    throw new ImportError(
      "File chưa có học viên. Hãy nhập dữ liệu từ hàng 2.",
    );
  }

  // Đếm mã để phát hiện trùng ngay trong file.
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(
      row.studentCode,
      (counts.get(row.studentCode) ?? 0) + 1,
    );
  }

  return rows.map((row) => ({
    ...row,
    issues: [
      ...row.issues,
      ...((counts.get(row.studentCode) ?? 0) > 1
        ? ["Mã học viên bị lặp trong file."]
        : []),
    ],
  }));
}

// Kiểm tra mã đã tồn tại trong Google Sheets.
export function flagExistingCodes(
  rows: ImportRow[],
  existing: unknown[][],
): ImportRow[] {
  const codes = new Set(
    existing.map((row) => codeKey(row[1])).filter(Boolean),
  );

  return rows.map((row) => ({
    ...row,
    issues: [
      ...row.issues,
      ...(codes.has(row.studentCode)
        ? ["Mã học viên đã tồn tại trong hệ thống."]
        : []),
    ],
  }));
}

// Kiểm tra GLV có quyền nhập học viên vào lớp đã chọn.
export function authorizeImport(
  accountId: string,
  classId: string,
  schoolYear: string,
  tables: unknown[][][],
) {
  const [
    accounts = [],
    teachers = [],
    classes = [],
    assignments = [],
  ] = tables;

  const account = accounts.find(
    (row) => cell(row[0]) === accountId,
  );

  if (
    !account ||
    cell(account[4]).toLowerCase() !== "teacher" ||
    cell(account[5]).toLowerCase() !== "active"
  ) {
    throw new ImportError(
      "Tài khoản không có quyền nhập học viên hoặc đã bị khóa.",
      403,
      "FORBIDDEN",
    );
  }

  const teacherIds = new Set(
    teachers
      .filter(
        (row) =>
          cell(row[1]) === accountId &&
          cell(row[3]).toLowerCase() === "active",
      )
      .map((row) => cell(row[0]))
      .filter(Boolean),
  );

  const assigned = assignments.some(
    (row) =>
      teacherIds.has(cell(row[1])) &&
      cell(row[2]) === classId &&
      cell(row[4]).toLowerCase() === "active",
  );

  const target = classes.find(
    (row) =>
      cell(row[0]) === classId &&
      cell(row[4]) === schoolYear &&
      cell(row[7]).toLowerCase() === "active",
  );

  if (!assigned || !target) {
    throw new ImportError(
      "Bạn không được phân công lớp này trong niên khóa đã chọn, hoặc lớp đã ngừng hoạt động.",
      403,
      "FORBIDDEN",
    );
  }

  return {
    classId,
    schoolYear,
    className: cell(target[2]),
  };
}