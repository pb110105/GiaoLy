"use client";

import { useState, type FormEvent } from "react";

import {
  calculateDiligence,
  type DiligenceRecord,
  type DiligenceStudent,
} from "@/lib/diligence";

type Props = {
  className: string;
  schoolYear: string;
  students: DiligenceStudent[];
  onBack: () => void;
};

type ResultRow =
  ReturnType<typeof calculateDiligence>[number] & {
    matched: boolean;
  };

type Meta = {
  filters: {
    years: Array<{
      MANIENHOC: number;
      TENNIENHOC: string;
    }>;
    grades: Array<{
      classes: Array<{
        MALOPHOC: number;
        TENLOPHOC: string;
      }>;
    }>;
  };
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function today() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function getJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ?? "Không thể tải dữ liệu CCAMS.",
    );
  }

  return data;
}

async function loadAllRecords(
  query: URLSearchParams,
  attendanceType: string,
): Promise<DiligenceRecord[]> {
  const records: DiligenceRecord[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams(query);

    params.set("loai", attendanceType);
    params.set("page", String(page));

    const data = await getJson(
      `/api/ccams/attendance?${params.toString()}`,
    );

    if (
      !Array.isArray(data.records) ||
      !Number.isSafeInteger(data.summary?.lastPage) ||
      data.summary.lastPage < 1 ||
      data.summary.page !== page
    ) {
      throw new Error("Dữ liệu phân trang CCAMS không hợp lệ.");
    }

    records.push(...data.records);

    if (page >= data.summary.lastPage) {
      break;
    }

    page++;
  }

  return records;
}

export default function ClassDiligence({
  className,
  schoolYear,
  students,
  onBack,
}: Props) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultRow[] | null>(null);
  const [resultPeriod, setResultPeriod] = useState("");

  async function handleCalculate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setResult(null);

    if (!fromDate || !toDate || toDate < fromDate) {
      setError("Hãy chọn khoảng ngày hợp lệ.");
      return;
    }

    if (toDate > today()) {
      setError("Chỉ tính chuyên cần đến ngày hôm nay.");
      return;
    }

    setLoading(true);

    try {
      // Tìm mã niên học CCAMS theo niên khóa của lớp.
      const initial = await getJson("/api/ccams/meta");
      const initialMeta = initial.data as Meta;

      const year = initialMeta.filters.years.find(
        (item) =>
          normalize(item.TENNIENHOC) === normalize(schoolYear),
      );

      if (!year) {
        throw new Error(
          `CCAMS chưa có niên khóa ${schoolYear}.`,
        );
      }

      // Mã lớp có thể khác nhau giữa các niên học.
      const metadata = await getJson(
        `/api/ccams/meta?nienhoc=${year.MANIENHOC}`,
      );

      const meta = metadata.data as Meta;

      const matchingClasses = meta.filters.grades
        .flatMap((grade) => grade.classes)
        .filter(
          (item) =>
            normalize(item.TENLOPHOC) === normalize(className),
        );

      if (matchingClasses.length !== 1) {
        throw new Error(
          "Không xác định được lớp CCAMS. Kiểm tra tên lớp và niên khóa.",
        );
      }

      const query = new URLSearchParams({
        date: fromDate,
        to: toDate,
        nienhoc: String(year.MANIENHOC),
        khoi_lop: `l_${matchingClasses[0].MALOPHOC}`,
      });

      // Lấy đủ mọi trang, gồm có mặt và cả hai loại vắng.
      const presentRecords = await loadAllRecords(query, "all");
      const absentRecords = await loadAllRecords(query, "v_all");

      const records = [...presentRecords, ...absentRecords];

      const knownCodes = new Set(
        records.map((record) =>
          String(record.externalStudentCode).trim(),
        ),
      );

      const rows = calculateDiligence(
        students,
        records,
        fromDate,
        toDate,
      );

      setResult(
        rows.map((row) => ({
          ...row,
          matched: knownCodes.has(row.studentCode),
        })),
      );

      setResultPeriod(`${fromDate} → ${toDate}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể tính chuyên cần.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="module-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">CHUYÊN CẦN</span>
          <h1>{className}</h1>
          <p>Niên khóa {schoolYear}</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
          disabled={loading}
        >
          Quay lại lớp giáo lý
        </button>
      </div>

      <article className="panel">
        <form
          className="ccams-filters"
          onSubmit={handleCalculate}
        >
          <fieldset disabled={loading}>
            <div className="ccams-filter-grid">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  required
                  value={fromDate}
                  max={today()}
                  onChange={(event) =>
                    setFromDate(event.target.value)
                  }
                />
              </label>

              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  required
                  value={toDate}
                  max={today()}
                  onChange={(event) =>
                    setToDate(event.target.value)
                  }
                />
              </label>
            </div>

            <p>
              Điểm lễ được cộng và bù trong khoảng ngày chọn.
              Giáo lý tính cả vắng có phép và không phép.
            </p>

            <div className="ccams-filter-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={students.length === 0}
              >
                {loading
                  ? "Đang lấy dữ liệu..."
                  : "Tính chuyên cần"}
              </button>
            </div>
          </fieldset>
        </form>
      </article>

      {students.length === 0 && (
        <p>Lớp này chưa có học viên.</p>
      )}

      {error && (
        <p role="alert" className="ccams-error">
          {error}
        </p>
      )}

      {result && (
        <article className="panel ccams-results">
          <div className="panel-heading">
            <div>
              <h2>Kết quả chuyên cần</h2>
              <p>{resultPeriod}</p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="student-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Điểm lễ</th>
                  <th>Yêu cầu</th>
                  <th>Còn thiếu</th>
                  <th>Vắng giáo lý</th>
                  <th>Kết quả</th>
                </tr>
              </thead>

              <tbody>
                {result.map((row, index) => (
                  <tr key={`${row.studentCode}-${index}`}>
                    <td>
                      <strong>{row.fullName}</strong>
                      <div>{row.studentCode || "Chưa có mã"}</div>
                    </td>

                    <td>{row.matched ? row.massPoints : "—"}</td>
                    <td>{row.requiredMassPoints}</td>
                    <td>
                      {row.matched ? row.missingMassPoints : "—"}
                    </td>
                    <td>
                      {row.matched ? row.catechismAbsences : "—"}
                    </td>

                    <td>
                      {!row.matched
                        ? "Chưa có dữ liệu khớp mã"
                        : (
                          <>
                            <div>
                              Lễ: {row.massPassed
                                ? "Đủ điểm"
                                : "Thiếu điểm"}
                            </div>
                            <div>
                              Giáo lý: {row.catechismPassed
                                ? "Trong giới hạn"
                                : "Vượt 5 buổi vắng"}
                            </div>
                          </>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ padding: "16px 24px" }}>
            Số buổi vắng tính theo bản ghi CCAMS.
            Chưa có dữ liệu khớp mã không được kết luận là đạt.
          </p>
        </article>
      )}
    </section>
  );
}