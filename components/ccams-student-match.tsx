"use client";

import { useState } from "react";

type Student = {
  id: string;
  fullName: string;
  birthDate: string;
  ccamsStudentCode: string;
};

type Candidate = {
  MAHOCVIEN: string;
  hoten: string;
  NGAYSINH: string | null;
  lop: string | null;
};

type MatchRow = {
  student: Student;
  candidates: Candidate[];
  selectedCode: string;
  message: string;
};

type Props = {
  className: string;
  students: Student[];
};

function normalize(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi");
}

async function findStudents(search: string) {
  const candidates = new Map<string, Candidate>();
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      search,
      page: String(page),
    });

    const response = await fetch(
      `/api/ccams/students?${params}`,
      { cache: "no-store" },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ?? "Không thể tìm học viên.",
      );
    }

    const rows = result.data?.rows;

    if (
      !Array.isArray(rows?.data) ||
      rows.page !== page ||
      !Number.isSafeInteger(rows.last_page) ||
      rows.last_page < 1
    ) {
      throw new Error("Danh sách CCAMS không hợp lệ.");
    }

    for (const candidate of rows.data as Candidate[]) {
      const code = String(candidate.MAHOCVIEN ?? "").trim();

      if (code) {
        candidates.set(code, {
          ...candidate,
          MAHOCVIEN: code,
        });
      }
    }

    if (page >= rows.last_page) break;

    page++;
  }

  return [...candidates.values()];
}

export default function CcamsStudentMatch({
  className,
  students,
}: Props) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function handleMatch() {
    if (loading) return;

    setLoading(true);
    setError("");
    setRows([]);

    try {
      const results: MatchRow[] = [];
      const cache = new Map<string, Candidate[]>();

      for (let index = 0; index < students.length; index++) {
        const student = students[index];
        const name = normalize(student.fullName);

        setProgress(
          `Đang đối chiếu ${index + 1}/${students.length}`,
        );

        if (!name) {
          results.push({
            student,
            candidates: [],
            selectedCode: "",
            message: "Thiếu họ tên.",
          });
          continue;
        }

        let candidates = cache.get(name);

        if (!candidates) {
          candidates = await findStudents(student.fullName);
          cache.set(name, candidates);
        }

        // Chỉ đề xuất người có cùng tên và lớp hiện tại.
        const sameNameAndClass = candidates.filter(
          (candidate) =>
            normalize(candidate.hoten) === name &&
            normalize(candidate.lop ?? "") ===
              normalize(className),
        );

        const birthDate = student.birthDate.slice(0, 10);

        const matches = birthDate
          ? sameNameAndClass.filter(
              (candidate) =>
                candidate.NGAYSINH?.slice(0, 10) === birthDate,
            )
          : sameNameAndClass;

        results.push({
          student,
          candidates: sameNameAndClass,
          selectedCode:
            matches.length === 1
              ? matches[0].MAHOCVIEN
              : "",
          message:
            matches.length === 1
              ? "Có đề xuất khớp; kiểm tra trước khi lưu."
              : matches.length > 1
                ? "Trùng tên; hãy chọn đúng học viên."
                : sameNameAndClass.length > 0
                  ? "Ngày sinh chưa khớp; cần kiểm tra."
                  : "Chưa tìm thấy cùng tên và lớp.",
        });
      }

      // Một mã CCAMS không tự gán cho hai học viên nội bộ.
      const counts = new Map<string, number>();

      for (const row of results) {
        if (row.selectedCode) {
          counts.set(
            row.selectedCode,
            (counts.get(row.selectedCode) ?? 0) + 1,
          );
        }
      }

      for (const row of results) {
        if ((counts.get(row.selectedCode) ?? 0) > 1) {
          row.selectedCode = "";
          row.message =
            "Nhiều học viên nội bộ khớp cùng mã; cần kiểm tra.";
        }
      }

      setRows(results);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể đối chiếu học viên.",
      );
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <article className="panel ccams-results">
      <div className="panel-heading">
        <div>
          <h2>Đối chiếu học viên CCAMS</h2>
          <p>Tìm mã theo tên, lớp và ngày sinh nếu có.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={loading || students.length === 0}
          onClick={() => void handleMatch()}
        >
          {loading ? progress : "Đối chiếu mã CCAMS"}
        </button>
      </div>

      {error && (
        <p className="ccams-error" role="alert">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="student-table">
            <thead>
              <tr>
                <th>Học viên trên web</th>
                <th>Mã đã lưu</th>
                <th>Học viên CCAMS đề xuất</th>
                <th>Kết quả</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id}>
                  <td>
                    <strong>{row.student.fullName}</strong>
                    <div>{row.student.birthDate || "Chưa có ngày sinh"}</div>
                  </td>

                  <td>
                    {row.student.ccamsStudentCode || "Chưa liên kết"}
                  </td>

                  <td>
                    <select
                      aria-label={`Chọn mã cho ${row.student.fullName}`}
                      value={row.selectedCode}
                      onChange={(event) => {
                        const selectedCode = event.target.value;

                        setRows((current) =>
                          current.map((item) =>
                            item.student.id === row.student.id
                              ? { ...item, selectedCode }
                              : item,
                          ),
                        );
                      }}
                    >
                      <option value="">Chưa chọn</option>

                      {row.candidates.map((candidate) => (
                        <option
                          key={candidate.MAHOCVIEN}
                          value={candidate.MAHOCVIEN}
                        >
                          {candidate.MAHOCVIEN} — {candidate.hoten}
                          {" — "}
                          {candidate.NGAYSINH || "Chưa có ngày sinh"}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}