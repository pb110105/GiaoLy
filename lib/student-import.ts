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

export function validateImportRows(
  table: unknown[][],
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date()),
): ImportRow[] {
  function normalizeHeader(value: unknown) {
    return cell(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  const aliases = {
    saint: ["tenth anh".replace(/ /g, ""), "saintname"],
    family: ["ho", "hovadem"],
    given: ["ten"],
    code: ["studentcode", "mahocvien", "mahv"],
    birth: ["birthdate", "ngaysinh"],
    gender: ["gender", "gioitinh"],
    guardian: ["guardianname", "tenphuhuynh", "hotenphuhuynh"],
    phone: ["guardianphone", "dienthoai", "sdt", "sodienthoai"],
  };

  // Tìm hàng tiêu đề, bỏ qua tiêu đề lớn và tên GLV.
  const headerIndex = table.findIndex((row) => {
    const names = row.map(normalizeHeader);

    return (
      aliases.saint.some((name) => names.includes(name)) &&
      aliases.family.some((name) => names.includes(name)) &&
      aliases.given.some((name) => names.includes(name))
    );
  });

  if (headerIndex < 0) {
    throw new ImportError(
      "Không tìm thấy hàng có các cột Tên Thánh, Họ và Tên.",
    );
  }

  const header = table[headerIndex].map(normalizeHeader);

  function findColumn(names: string[]) {
    const indexes = header
      .map((name, index) => names.includes(name) ? index : -1)
      .filter((index) => index >= 0);

    if (indexes.length > 1) {
      throw new ImportError(
        "File có tên cột bị trùng. Hãy kiểm tra hàng tiêu đề.",
      );
    }

    return indexes[0] ?? -1;
  }

  const columns = {
    saint: findColumn(aliases.saint),
    family: findColumn(aliases.family),
    given: findColumn(aliases.given),
    code: findColumn(aliases.code),
    birth: findColumn(aliases.birth),
    gender: findColumn(aliases.gender),
    guardian: findColumn(aliases.guardian),
    phone: findColumn(aliases.phone),
  };

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

  for (let index = headerIndex + 1; index < table.length; index++) {
    const values = table[index];

    const get = (column: number): unknown =>
      column < 0 ? "" : values[column];

    const text = (column: number) =>
      cell(get(column)).replace(/\s+/g, " ");

    const saintName = text(columns.saint);
    const familyName = text(columns.family);
    const givenName = text(columns.given);
    const studentCode = codeKey(get(columns.code));

    // Bỏ qua hàng trống hoặc chỉ chứa số thứ tự/ô điểm danh.
    const hasStudentData = [
      columns.saint,
      columns.family,
      columns.given,
      columns.code,
      columns.birth,
      columns.gender,
      columns.guardian,
      columns.phone,
    ].some((column) => cell(get(column)) !== "");

    if (!hasStudentData) continue;

    if (rows.length >= MAX_IMPORT_ROWS) {
      throw new ImportError(
        `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} học viên.`,
      );
    }

    const issues: string[] = [];

    if (!saintName || saintName.length > 80) {
      issues.push("Tên Thánh bắt buộc, tối đa 80 ký tự.");
    }

    if (!familyName || familyName.length > 80) {
      issues.push("Họ và tên đệm bắt buộc, tối đa 80 ký tự.");
    }

    if (!givenName || givenName.length > 40) {
      issues.push("Tên bắt buộc, tối đa 40 ký tự.");
    }

    const fullName = [saintName, familyName, givenName]
      .filter(Boolean)
      .join(" ");

    if (fullName.length > 120) {
      issues.push("Tên đầy đủ tối đa 120 ký tự.");
    }

    if (
      studentCode &&
      !/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(studentCode)
    ) {
      issues.push("Mã học viên không hợp lệ, tối đa 40 ký tự.");
    }

    const birthValue = get(columns.birth);
    const birthDate = normalizeBirthDate(birthValue, today);

    if (cell(birthValue) && !birthDate) {
      issues.push(
        "Ngày sinh không hợp lệ. Dùng ngày Excel, yyyy-mm-dd hoặc dd/mm/yyyy.",
      );
    }

    const genderValue = text(columns.gender);
    const gender = genderNames[genderValue.toLowerCase()] ?? "";

    if (genderValue && !gender) {
      issues.push("Giới tính phải là Nam, Nữ hoặc Khác.");
    }

    const guardianName = text(columns.guardian);

    if (guardianName.length > 120) {
      issues.push("Tên phụ huynh tối đa 120 ký tự.");
    }

    const phoneValue = get(columns.phone);
    const guardianPhone = cell(phoneValue).replace(/[\s().-]/g, "");

    if (
      guardianPhone &&
      (
        typeof phoneValue !== "string" ||
        !/^(?:0\d{9,10}|\+[1-9]\d{8,14})$/.test(guardianPhone)
      )
    ) {
      issues.push(
        "Điện thoại phải là Text, giữ số 0 đầu hoặc dùng +mã quốc gia.",
      );
    }

    rows.push({
      rowNumber: index + 1,
      studentCode,
      fullName,
      birthDate: birthDate || cell(birthValue).slice(0, 32),
      gender: gender || genderValue,
      guardianName,
      guardianPhone,
      issues,
    });
  }

  if (!rows.length) {
    throw new ImportError("File chưa có dữ liệu học viên.");
  }

  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.studentCode) continue;

    counts.set(
      row.studentCode,
      (counts.get(row.studentCode) ?? 0) + 1,
    );
  }

  return rows.map((row) => ({
    ...row,
    issues: [
      ...row.issues,
      ...(
        row.studentCode &&
        (counts.get(row.studentCode) ?? 0) > 1
          ? ["Mã học viên bị lặp trong file."]
          : []
      ),
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