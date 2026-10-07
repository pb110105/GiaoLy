"use client";

import { useEffect, useState, type DragEvent } from "react";
import { Armchair, Plus, X } from "lucide-react";

type Student = {
  id: string;
  fullName: string;
  studentCode: string;
};

type Props = {
  classId: string;
  schoolYear: string;
  className: string;
  students: Student[];
};


export default function SeatingPlan({
  classId,
  schoolYear,
  className,
  students,
}: Props) {
  const [seats, setSeats] = useState<(string | null)[][]>(
    () => Array.from({ length: 3 }, () => Array(4).fill(null)),
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const dirty =
    !loading &&
    !loadError &&
    JSON.stringify(seats) !== savedSnapshot;

  useEffect(() => {
    const controller = new AbortController();

    async function loadPlan() {
      setLoading(true);
      setLoadError("");
      setMessage("");
      setSelectedId(null);

      try {
        const params = new URLSearchParams({
          classId,
          schoolYear,
        });

        const response = await fetch(
          `/api/seating-plan?${params}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không tải được sơ đồ.");
        }

        const loadedSeats: (string | null)[][] =
          data.seats ??
          Array.from({ length: 3 }, () => Array(4).fill(null));

        if (controller.signal.aborted) return;

        setSeats(loadedSeats);
        setRevision(data.revision);
        setSavedSnapshot(JSON.stringify(loadedSeats));
      } catch (error) {
        if (controller.signal.aborted) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Không tải được sơ đồ.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPlan();

    return () => controller.abort();
  }, [classId, schoolYear, reloadKey]);

  useEffect(() => {
    if (!dirty) return;

    function warnBeforeLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeave);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeave);
    };
  }, [dirty]);

  async function savePlan() {
    if (loading || saving || loadError || !dirty) return;

    setSaving(true);
    setMessage("");

    const snapshot = JSON.stringify(seats);

    try {
      const response = await fetch("/api/seating-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-giaoly-seating": "1",
        },
        body: JSON.stringify({
          classId,
          schoolYear,
          seats: JSON.parse(snapshot),
          revision,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không lưu được sơ đồ.");
      }

      setRevision(data.revision);
      setSavedSnapshot(snapshot);
      setMessage("Đã lưu sơ đồ thành công.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không lưu được sơ đồ. Hãy thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  function reloadPlan() {
    if (
      dirty &&
      !window.confirm(
        "Tải lại sẽ bỏ các thay đổi chưa lưu. Tiếp tục?",
      )
    ) {
      return;
    }

    setReloadKey((current) => current + 1);
  }

  const studentMap = new Map(
    students.map((student) => [student.id, student]),
  );

  const assignedIds = new Set(
    seats.flat().filter((id): id is string => id !== null),
  );

  const availableStudents = students.filter(
    (student) =>
      !assignedIds.has(student.id) &&
      student.fullName.toLocaleLowerCase("vi").includes(
        search.trim().toLocaleLowerCase("vi"),
      ),
  );

  function addRow() {
    if (loading || saving || loadError || seats.length >= 30) return;
    setSeats((current) => [
      ...current,
      Array(current[0].length).fill(null),
    ]);
  }

  function addColumn() {
    if (loading || saving || loadError || seats[0].length >= 20) return;
    setSeats((current) =>
      current.map((row) => [...row, null]),
    );
  }

  function placeStudent(
    studentId: string,
    targetRow: number,
    targetColumn: number,
  ) {
    if (loading || saving || loadError) return;
    if (!studentMap.has(studentId)) return;

    setSeats((current) => {
      const next = current.map((row) => [...row]);
            const sourceRow = current.findIndex((row) =>
        row.includes(studentId),
      );

      const sourceColumn =
        sourceRow >= 0
          ? current[sourceRow].indexOf(studentId)
          : -1;

      const displacedId = next[targetRow][targetColumn];

      if (sourceRow >= 0 && sourceColumn >= 0) {
        next[sourceRow][sourceColumn] = displacedId;
      }

      next[targetRow][targetColumn] = studentId;
      return next;
    });

    setSelectedId(null);
  }

  function removeStudent(studentId: string) {
    if (loading || saving || loadError) return;
    setSeats((current) =>
      current.map((row) =>
        row.map((id) => (id === studentId ? null : id)),
      ),
    );

    setSelectedId((current) =>
      current === studentId ? null : current,
    );
  }

  function startDrag(
    event: DragEvent<HTMLElement>,
    studentId: string,
  ) {
    event.dataTransfer.setData("text/plain", studentId);
    event.dataTransfer.effectAllowed = "move";
  }

  function allowDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  const selectedStudent = selectedId
    ? studentMap.get(selectedId)
    : undefined;

  return (
    <article className="panel sp-panel">
      <div className="sp-heading">
        <div>
          <span>LỚP ĐANG XEM</span>
          <h2>{className}</h2>
        </div>

        <strong>
          Đã xếp {assignedIds.size}/{students.length} học viên
        </strong>
      </div>
            <div className="sp-save-bar">
        <button
          type="button"
          className="primary-button"
          onClick={savePlan}
          disabled={loading || saving || Boolean(loadError) || !dirty}
        >
          {saving ? "Đang lưu..." : "Lưu sơ đồ"}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={reloadPlan}
          disabled={loading || saving}
        >
          Tải lại sơ đồ
        </button>

        <span role="status">
          {loading
            ? "Đang tải sơ đồ..."
            : loadError || message ||
              (dirty ? "Có thay đổi chưa lưu." : "Sơ đồ đã đồng bộ.")}
        </span>
      </div>  
      <p className="sp-help" aria-live="polite">
        {selectedStudent
          ? `Đã chọn ${selectedStudent.fullName}. Bấm vào ghế để xếp chỗ.`
          : "Kéo học viên vào ghế, hoặc chọn học viên rồi bấm vào ghế."}
      </p>

      <fieldset className="sp-editor" disabled={loading || saving || Boolean(loadError)}>
        <div className="sp-layout">
        <div className="sp-room">
          <div className="seating-board">BẢNG LỚP</div>

          <div className="sp-scroll">
            <div className="sp-grid-area">
              <div
                className="sp-grid"
                style={{
                  gridTemplateColumns:
                    `repeat(${seats[0].length}, 150px)`,
                }}
              >
                {seats.map((row, rowIndex) =>
                  row.map((studentId, columnIndex) => {
                    const student = studentId
                      ? studentMap.get(studentId)
                      : undefined;

                    return (
                      <div
                        key={`${rowIndex}-${columnIndex}`}
                        className={[
                          "sp-seat",
                          student ? "is-filled" : "",
                          studentId && selectedId === studentId
                            ? "is-selected"
                            : "",
                        ].join(" ")}
                        onDragOver={allowDrop}
                        onDrop={(event) => {
                          event.preventDefault();
                          const id =
                            event.dataTransfer.getData("text/plain");
                          placeStudent(id, rowIndex, columnIndex);
                        }}
                      >
                        <button
                          type="button"
                          className="sp-seat-main"
                          draggable={Boolean(student)}
                          onDragStart={(event) => {
                            if (student) startDrag(event, student.id);
                          }}
                          onClick={() => {
                            if (selectedId) {
                              placeStudent(
                                selectedId,
                                rowIndex,
                                columnIndex,
                              );
                            } else if (student) {
                              setSelectedId(student.id);
                            }
                          }}
                          aria-label={
                            `Hàng ${rowIndex + 1}, cột ${columnIndex + 1}: ` +
                            (student?.fullName ?? "ghế trống")
                          }
                        >
                          <span className="sp-coordinate">
                            H{rowIndex + 1} · C{columnIndex + 1}
                          </span>

                          <Armchair size={22} />

                          <strong>
                            {student?.fullName ?? "Ghế trống"}
                          </strong>
                        </button>

                        {student && (
                          <button
                            type="button"
                            className="sp-remove"
                            onClick={() => removeStudent(student.id)}
                            aria-label={`Gỡ ${student.fullName} khỏi ghế`}
                            title="Đưa về danh sách chưa xếp"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>

              <button
                type="button"
                className="sp-add-column"
                onClick={addColumn}
                title="Thêm một cột"
                aria-label="Thêm một cột"
              >
                <Plus size={22} />
                <span>Thêm cột</span>
              </button>
            </div>

            <button
              type="button"
              className="sp-add-row"
              onClick={addRow}
            >
              <Plus size={18} />
              Thêm hàng
            </button>
          </div>
        </div>

        <aside
          className="sp-roster"
          onDragOver={allowDrop}
          onDrop={(event) => {
            event.preventDefault();
            const id = event.dataTransfer.getData("text/plain");
            if (studentMap.has(id)) removeStudent(id);
          }}
        >
          <h3>Học viên chưa xếp</h3>

          <p>
            {students.length - assignedIds.size} học viên.
            Kéo về đây để gỡ khỏi ghế.
          </p>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên học viên..."
            aria-label="Tìm học viên chưa xếp"
          />

          {selectedId && (
            <button
              type="button"
              className="sp-cancel"
              onClick={() => setSelectedId(null)}
            >
              Bỏ chọn học viên
            </button>
          )}

          <div className="sp-student-list">
            {availableStudents.map((student) => (
              <button
                type="button"
                key={student.id}
                draggable
                className={
                  "sp-student" +
                  (selectedId === student.id ? " is-selected" : "")
                }
                onDragStart={(event) =>
                  startDrag(event, student.id)
                }
                onClick={() =>
                  setSelectedId((current) =>
                    current === student.id ? null : student.id,
                  )
                }
                aria-pressed={selectedId === student.id}
              >
                <strong>{student.fullName}</strong>
              </button>
            ))}

            {availableStudents.length === 0 && (
              <p className="sp-no-students">
                {students.length === 0
                  ? "Lớp chưa có học viên."
                  : assignedIds.size === students.length
                    ? "Đã xếp hết học viên."
                    : "Không tìm thấy học viên."}
              </p>
            )}
          </div>
        </aside>
      </div>
      </fieldset>
    </article>
  );
}