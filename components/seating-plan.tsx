"use client";

import { useState, type DragEvent } from "react";
import { Armchair, Plus, X } from "lucide-react";

type Student = {
  id: string;
  fullName: string;
  studentCode: string;
};

type Props = {
  className: string;
  students: Student[];
};

export default function SeatingPlan({
  className,
  students,
}: Props) {
  const [seats, setSeats] = useState<(string | null)[][]>(
    () => Array.from({ length: 3 }, () => Array(4).fill(null)),
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    setSeats((current) => [
      ...current,
      Array(current[0].length).fill(null),
    ]);
  }

  function addColumn() {
    setSeats((current) =>
      current.map((row) => [...row, null]),
    );
  }

  function placeStudent(
    studentId: string,
    targetRow: number,
    targetColumn: number,
  ) {
    if (!studentMap.has(studentId)) return;

    setSeats((current) => {
      const next = current.map((row) => [...row]);
      let source: [number, number] | null = null;

      current.forEach((row, rowIndex) => {
        row.forEach((id, columnIndex) => {
          if (id === studentId) {
            source = [rowIndex, columnIndex];
          }
        });
      });

      const displacedId = next[targetRow][targetColumn];

      // Chuyển giữa hai ghế: đổi chỗ nếu ghế đích có người.
      // Kéo từ danh sách: người ở ghế đích trở về danh sách.
      if (source) {
        const [sourceRow, sourceColumn] = source;
        next[sourceRow][sourceColumn] = displacedId;
      }

      next[targetRow][targetColumn] = studentId;
      return next;
    });

    setSelectedId(null);
  }

  function removeStudent(studentId: string) {
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

      <p className="sp-help" aria-live="polite">
        {selectedStudent
          ? `Đã chọn ${selectedStudent.fullName}. Bấm vào ghế để xếp chỗ.`
          : "Kéo học viên vào ghế, hoặc chọn học viên rồi bấm vào ghế."}
      </p>

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
    </article>
  );
}