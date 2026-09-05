import "server-only";

export type AccountRole = "admin" | "teacher";

export type AccessScope = {
  accountId: string;
  phone: string;
  email: string;
  role: AccountRole;
  displayName: string;
  isAdmin: boolean;
  teacherIds: Set<string>;
  assignedClassIds: Set<string>;
  assignmentRoleByClass: Map<string, string>;
};

export class AccessError extends Error {
  constructor(
    message: string,
    public status = 403,
    public code = "FORBIDDEN",
  ) {
    super(message);
  }
}

export function accessCell(value: unknown) {
  return String(value ?? "").trim();
}

export function isAccountRole(
  value: string,
): value is AccountRole {
  return value === "admin" || value === "teacher";
}

export function resolveAccessScope(
  accountId: string,
  tables: {
    accounts: unknown[][];
    teachers: unknown[][];
    assignments: unknown[][];
  },
): AccessScope {
  const { accounts, teachers, assignments } = tables;

  const accountRow = accounts.find(
    (row) => accessCell(row[0]) === accountId,
  );

  if (!accountRow) {
    throw new AccessError(
      "Không tìm thấy tài khoản.",
      403,
      "ACCOUNT_NOT_FOUND",
    );
  }

  const roleValue = accessCell(accountRow[4]).toLowerCase();
  const status = accessCell(accountRow[5]).toLowerCase();

  if (!isAccountRole(roleValue) || status !== "active") {
    throw new AccessError(
      "Tài khoản không có quyền truy cập hoặc đã bị khóa.",
      403,
      "ACCOUNT_FORBIDDEN",
    );
  }

  const activeTeacherRows = teachers.filter(
    (row) =>
      accessCell(row[1]) === accountId &&
      accessCell(row[3]).toLowerCase() === "active",
  );

  /*
   * Admin không bắt buộc phải có hồ sơ trong TEACHER.
   * Teacher bắt buộc phải được liên kết với TEACHER.
   */
  if (
    roleValue === "teacher" &&
    activeTeacherRows.length === 0
  ) {
    throw new AccessError(
      "Tài khoản chưa được liên kết với hồ sơ giáo lý viên.",
      403,
      "TEACHER_NOT_LINKED",
    );
  }

  const teacherIds = new Set(
    activeTeacherRows
      .map((row) => accessCell(row[0]))
      .filter(Boolean),
  );

  const activeAssignments = assignments.filter(
    (row) =>
      teacherIds.has(accessCell(row[1])) &&
      accessCell(row[4]).toLowerCase() === "active",
  );

  const assignedClassIds = new Set(
    activeAssignments
      .map((row) => accessCell(row[2]))
      .filter(Boolean),
  );

  const assignmentRoleByClass = new Map(
    activeAssignments.map((row) => [
      accessCell(row[2]),
      accessCell(row[3]),
    ]),
  );

  const teacherName = accessCell(
    activeTeacherRows[0]?.[2],
  );

  return {
    accountId,
    phone: accessCell(accountRow[1]),
    email: accessCell(accountRow[2]),
    role: roleValue,
    displayName:
      teacherName ||
      (roleValue === "admin"
        ? "Quản trị hệ thống"
        : "Giáo lý viên"),
    isAdmin: roleValue === "admin",
    teacherIds,
    assignedClassIds,
    assignmentRoleByClass,
  };
}

export function canAccessClass(
  scope: AccessScope,
  classId: string,
) {
  return (
    scope.isAdmin ||
    scope.assignedClassIds.has(classId)
  );
}