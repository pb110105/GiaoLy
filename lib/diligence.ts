export type DiligenceRecord = {
  externalStudentCode: string;
  attendanceDate: string;
  attendanceType: number | null;
  status: "present" | "excused" | "absent";
};

export type DiligenceStudent = {
  studentCode: string;
  fullName: string;
};

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Ngày thống kê không hợp lệ.");
  }

  return date;
}

export function calculateDiligence(
  students: DiligenceStudent[],
  records: DiligenceRecord[],
  fromDate: string,
  toDate: string,
) {
  const start = parseDate(fromDate);
  const end = parseDate(toDate);

  if (start > end) {
    throw new Error(
      "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
    );
  }

  // Mỗi thứ Năm và Chủ nhật trong khoảng chọn:
  // yêu cầu 1 điểm lễ.
  let requiredMassPoints = 0;

  for (
    const day = new Date(start.getTime());
    day <= end;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const weekday = day.getUTCDay();

    if (weekday === 4 || weekday === 0) {
      requiredMassPoints++;
    }
  }

  const statistics = new Map<
    string,
    {
      massDates: Set<string>;
      catechismAbsentDates: Set<string>;
    }
  >();

  for (const record of records) {
    const studentCode = record.externalStudentCode.trim();
    const date = record.attendanceDate.slice(0, 10);

    if (
      !studentCode ||
      date < fromDate ||
      date > toDate
    ) {
      continue;
    }

    const weekday = parseDate(date).getUTCDay();

    let student = statistics.get(studentCode);

    if (!student) {
      student = {
        massDates: new Set(),
        catechismAbsentDates: new Set(),
      };

      statistics.set(studentCode, student);
    }

    // Thánh lễ: thứ Năm, Sáu, Bảy và Chủ nhật.
    if (
      record.attendanceType === 1 &&
      record.status === "present" &&
      [4, 5, 6, 0].includes(weekday)
    ) {
      student.massDates.add(date);
    }

    // Giáo lý: tính cả vắng có phép và không phép.
    if (
      record.attendanceType === 2 &&
      (
        record.status === "excused" ||
        record.status === "absent"
      )
    ) {
      student.catechismAbsentDates.add(date);
    }
  }

  return students.map((student) => {
    const studentCode = student.studentCode.trim();
    const statistic = statistics.get(studentCode);

    const massPoints = statistic?.massDates.size ?? 0;
    const catechismAbsences =
      statistic?.catechismAbsentDates.size ?? 0;

    const missingMassPoints = Math.max(
      0,
      requiredMassPoints - massPoints,
    );

    return {
      studentCode,
      fullName: student.fullName,
      massPoints,
      requiredMassPoints,
      missingMassPoints,
      extraMassPoints: Math.max(
        0,
        massPoints - requiredMassPoints,
      ),
      massPassed: missingMassPoints === 0,
      catechismAbsences,
      catechismPassed: catechismAbsences <= 5,
    };
  });
}