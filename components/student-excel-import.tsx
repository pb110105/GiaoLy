"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";

import {
  MAX_IMPORT_BYTES,
  type ImportPreview,
  type ImportResponse,
  type ImportSaved,
} from "@/lib/student-import";

type ClassItem = {
  id: string;
  className: string;
  schoolYear: string;
};

type StudentExcelImportProps = {
  classes: ClassItem[];
  schoolYear: string;
  onImported: (
    result: ImportSaved,
  ) => Promise<void> | void;
};

export default function StudentExcelImport({
  classes,
  schoolYear,
  onImported,
}: StudentExcelImportProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableClasses = classes.filter(
    (item) =>
      item.schoolYear.trim() ===
      schoolYear.trim(),
  );

  return (
    <>
      <button
        type="button"
        className="excel-import-trigger"
        disabled={!availableClasses.length}
        title={
          !availableClasses.length
            ? "Bạn chưa có lớp trong niên khóa này."
            : undefined
        }
        onClick={() => setIsOpen(true)}
      >
        <Upload size={17} />
        Nhập Excel
      </button>

      {isOpen && (
        <ImportExcelModal
          classes={availableClasses}
          schoolYear={schoolYear}
          onImported={onImported}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

type ImportExcelModalProps = {
  classes: ClassItem[];
  schoolYear: string;
  onImported: (
    result: ImportSaved,
  ) => Promise<void> | void;
  onClose: () => void;
};

function ImportExcelModal({
  classes,
  schoolYear,
  onImported,
  onClose,
}: ImportExcelModalProps) {
  const [classId, setClassId] = useState(
    classes.length === 1
      ? classes[0].id
      : "",
  );

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<ImportPreview | null>(null);

  const [loading, setLoading] = useState<
    "preview" | "commit" | null
  >(null);

  const [error, setError] = useState("");
  const [saved, setSaved] =
    useState<ImportSaved | null>(null);

  const [onlyErrors, setOnlyErrors] =
    useState(false);

  const selectedClass = classes.find(
    (item) => item.id === classId,
  );

  const isBusy = loading !== null;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !isBusy
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow = "";
    };
  }, [isBusy, onClose]);

  function handleChooseFile(
    selectedFile: File | null,
  ) {
    setFile(null);
    setPreview(null);
    setSaved(null);
    setOnlyErrors(false);
    setError("");

    if (!selectedFile) {
      return;
    }

    if (!/\.xlsx$/i.test(selectedFile.name)) {
      setError(
        "Chỉ nhận file Excel có định dạng .xlsx.",
      );
      return;
    }

    if (
      !selectedFile.size ||
      selectedFile.size >
        MAX_IMPORT_BYTES
    ) {
      setError(
        "File Excel phải có dữ liệu và không vượt quá 2 MB.",
      );
      return;
    }

    setFile(selectedFile);
  }

  async function submitImport(
    action: "preview" | "commit",
  ) {
    if (
      !file ||
      !classId ||
      isBusy
    ) {
      return;
    }

    if (
      action === "commit" &&
      !preview?.canImport
    ) {
      return;
    }

    setLoading(action);
    setError("");
    setOnlyErrors(false);

    const form = new FormData();

    form.set("action", action);
    form.set("classId", classId);
    form.set("schoolYear", schoolYear);
    form.set("file", file);

    if (preview) {
      form.set(
        "fingerprint",
        preview.fingerprint,
      );
    }

    try {
      const response = await fetch(
        "/api/students/import",
        {
          method: "POST",
          headers: {
            "x-giaoly-import": "1",
          },
          body: form,
        },
      );

      const data =
        (await response.json()) as ImportResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          !data.success
            ? data.message
            : "Không thể nhập danh sách.",
        );
      }

      if (data.phase === "preview") {
        setPreview(data);

        if (action === "commit") {
          setError(
            "Dữ liệu đã thay đổi hoặc vừa xuất hiện mã trùng. Chưa lưu học viên nào; hãy kiểm tra lại.",
          );
        }

        return;
      }

      setSaved(data);
      setPreview(null);

      await onImported(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Mất kết nối. Vui lòng thử lại.",
      );
    } finally {
      setLoading(null);
    }
  }

  const visibleRows =
    preview?.rows.filter(
      (row) =>
        !onlyErrors ||
        row.issues.length > 0,
    ) ?? [];

  const genderLabel: Record<string, string> = {
    male: "Nam",
    female: "Nữ",
    other: "Khác",
  };

  return (
    <div
      className="excel-modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isBusy) {
          onClose();
        }
      }}
    >
      <section
        className="excel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-modal-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="excel-modal-header">
          <span className="excel-modal-icon">
            <FileSpreadsheet size={24} />
          </span>

          <div>
            <h2 id="excel-modal-title">
              Nhập học viên từ Excel
            </h2>

            <p>
              Niên khóa {schoolYear}
            </p>
          </div>

          <button
            type="button"
            className="excel-modal-close"
            aria-label="Đóng"
            disabled={isBusy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        {saved ? (
          <div
            className="excel-import-success"
            role="status"
          >
            <CheckCircle2 size={45} />

            <h3>
              {saved.alreadyImported
                ? "Danh sách này đã được lưu"
                : "Nhập học viên thành công"}
            </h3>

            <p>
              {saved.count} học viên
              {selectedClass
                ? ` · ${selectedClass.className}`
                : ""}
            </p>

            <button
              type="button"
              className="excel-primary-button"
              onClick={onClose}
            >
              Hoàn tất
            </button>
          </div>
        ) : (
          <>
            <div className="excel-modal-body">
              <label className="excel-form-field">
                <span>Lớp nhận học viên</span>

                <select
                  required
                  value={classId}
                  disabled={isBusy}
                  onChange={(event) => {
                    setClassId(
                      event.target.value,
                    );

                    setPreview(null);
                    setError("");
                  }}
                >
                  <option value="">
                    Chọn lớp được phân công
                  </option>

                  {classes.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.className}
                    </option>
                  ))}
                </select>
              </label>

              <label className="excel-upload-box">
                <FileSpreadsheet size={28} />

                <span>
                  <strong>
                    {file?.name ??
                      "Chọn danh sách học viên"}
                  </strong>

                  <small>
                    File .xlsx · tối đa 500 học viên · 2 MB
                  </small>
                </span>

                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={isBusy}
                  onChange={(event) => {
                    handleChooseFile(
                      event.target.files?.[0] ??
                        null,
                    );

                    event.target.value = "";
                  }}
                />
              </label>

              <p className="excel-upload-note">
                Bắt buộc các cột: Tên Thánh, Họ, Tên.
                Mã học viên, ngày sinh, giới tính và thông tin
                phụ huynh có thể để trống hoặc không có cột.
                Nếu thiếu mã học viên, hệ thống sẽ tự tạo.
              </p>

              {error && (
                <div
                  className="excel-import-error"
                  role="alert"
                >
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {preview && (
                <section className="excel-preview">
                  <div className="excel-preview-heading">
                    <div>
                      <strong>
                        {preview.total} học viên
                      </strong>

                      <span>
                        {preview.className} ·{" "}
                        {preview.invalidCount
                          ? `${preview.invalidCount} dòng cần sửa`
                          : "Tất cả dòng đều hợp lệ"}
                      </span>
                    </div>

                    {preview.invalidCount > 0 && (
                      <label>
                        <input
                          type="checkbox"
                          checked={onlyErrors}
                          onChange={(event) =>
                            setOnlyErrors(
                              event.target.checked,
                            )
                          }
                        />

                        Chỉ hiện dòng lỗi
                      </label>
                    )}
                  </div>

                  <div
                    className="excel-table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Bảng xem trước học viên"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Mã học viên</th>
                          <th>Họ tên</th>
                          <th>Ngày sinh</th>
                          <th>Giới tính</th>
                          <th>Phụ huynh</th>
                          <th>Điện thoại</th>
                          <th>Kiểm tra</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visibleRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={
                              row.issues.length
                                ? "excel-invalid-row"
                                : ""
                            }
                          >
                            <td>{row.rowNumber}</td>
                            <td>{row.studentCode}</td>
                            <td>{row.fullName}</td>
                            <td>{row.birthDate}</td>

                            <td>
                              {genderLabel[
                                row.gender
                              ] ?? row.gender}
                            </td>

                            <td>
                              {row.guardianName}
                            </td>

                            <td>
                              {row.guardianPhone}
                            </td>

                            <td>
                              {row.issues.length ? (
                                <ul>
                                  {row.issues.map(
                                    (issue) => (
                                      <li key={issue}>
                                        {issue}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              ) : (
                                <span className="excel-valid-row">
                                  <CheckCircle2
                                    size={14}
                                  />
                                  Hợp lệ
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {preview.invalidCount > 0 && (
                    <p className="excel-preview-note">
                      Chưa lưu dữ liệu. Hãy sửa
                      các dòng lỗi trong Excel,
                      chọn lại file rồi xem trước.
                    </p>
                  )}
                </section>
              )}
            </div>

            <footer className="excel-modal-footer">
              <span aria-live="polite">
                {loading === "preview"
                  ? "Đang đọc và kiểm tra dữ liệu..."
                  : loading === "commit"
                    ? "Đang lưu danh sách..."
                    : preview?.canImport
                      ? `Sẽ thêm ${preview.total} học viên vào ${preview.className}.`
                      : "Dữ liệu chỉ được lưu sau khi xác nhận."}
              </span>

              <div>
                <button
                  type="button"
                  className="excel-secondary-button"
                  disabled={isBusy}
                  onClick={onClose}
                >
                  Đóng
                </button>

                {!preview?.canImport ? (
                  <button
                    type="button"
                    className="excel-primary-button"
                    disabled={
                      isBusy ||
                      !file ||
                      !classId
                    }
                    onClick={() =>
                      void submitImport(
                        "preview",
                      )
                    }
                  >
                    {loading === "preview" && (
                      <LoaderCircle
                        size={17}
                        className="excel-loading-icon"
                      />
                    )}

                    Xem trước
                  </button>
                ) : (
                  <button
                    type="button"
                    className="excel-primary-button"
                    disabled={isBusy}
                    onClick={() =>
                      void submitImport(
                        "commit",
                      )
                    }
                  >
                    {loading === "commit" && (
                      <LoaderCircle
                        size={17}
                        className="excel-loading-icon"
                      />
                    )}

                    Xác nhận nhập{" "}
                    {preview.total} học viên
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}