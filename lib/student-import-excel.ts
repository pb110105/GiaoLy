import { inflateRawSync } from "node:zlib";
import { readSheet } from "read-excel-file/node";

import {
  ImportError,
  MAX_IMPORT_BYTES,
  validateImportRows,
} from "./student-import";

// File .xlsx thực chất là một gói ZIP chứa các file XML.
function inspectXlsx(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_IMPORT_BYTES) {
    throw new ImportError(
      "File Excel phải có dữ liệu và không vượt quá 2 MB.",
      413,
    );
  }

  const end = buffer.lastIndexOf(
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  );

  if (end < 0 || end + 22 > buffer.length) {
    throw new ImportError("File không phải Excel .xlsx hợp lệ.");
  }

  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);

  if (
    buffer.readUInt16LE(end + 4) ||
    buffer.readUInt16LE(end + 6) ||
    !entries ||
    entries > 150
  ) {
    throw new ImportError(
      "File Excel quá phức tạp. Hãy dùng file mẫu.",
    );
  }

  const maxExpandedBytes = 8 * 1024 * 1024;
  const names = new Set<string>();

  let expanded = 0;
  let workbookFound = false;

  for (let i = 0; i < entries; i++) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    ) {
      throw new ImportError("File Excel bị hỏng.");
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const declaredSize = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28);
    const extraSize = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);

    const name = buffer
      .subarray(offset + 46, offset + 46 + nameSize)
      .toString("utf8");

    if (
      (flags & 1) ||
      ![0, 8].includes(method) ||
      declaredSize > maxExpandedBytes ||
      names.has(name)
    ) {
      throw new ImportError(
        "File được bảo vệ, quá lớn hoặc không hợp lệ. Hãy dùng file mẫu.",
      );
    }

    names.add(name);

    if (
      localOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50
    ) {
      throw new ImportError("File Excel bị hỏng.");
    }

    const start =
      localOffset +
      30 +
      buffer.readUInt16LE(localOffset + 26) +
      buffer.readUInt16LE(localOffset + 28);

    if (start + compressedSize > buffer.length) {
      throw new ImportError("File Excel bị hỏng.");
    }

    const raw = buffer.subarray(start, start + compressedSize);

    const bytes =
      method === 0
        ? raw
        : inflateRawSync(raw, {
            maxOutputLength: maxExpandedBytes,
          });

    expanded += bytes.length;

    if (
      bytes.length !== declaredSize ||
      expanded > maxExpandedBytes
    ) {
      throw new ImportError(
        "File Excel quá lớn sau khi giải nén. Hãy dùng file mẫu.",
      );
    }

    if (name === "xl/workbook.xml") {
      workbookFound = true;
    }

    // Chỉ nhận dữ liệu trực tiếp, không nhận ô chứa công thức.
    if (
      /^xl\/worksheets\/.*\.xml$/.test(name) &&
      /<(?:\w+:)?f(?:[\s/>])/.test(bytes.toString("utf8"))
    ) {
      throw new ImportError(
        "File có công thức. Hãy sao chép và dán dưới dạng giá trị trước khi nhập.",
      );
    }

    offset += 46 + nameSize + extraSize + commentSize;
  }

  if (!workbookFound) {
    throw new ImportError("File không phải Excel .xlsx hợp lệ.");
  }
}

// Đọc trang tính đầu tiên rồi kiểm tra từng dòng học viên.
export async function parseStudentWorkbook(buffer: Buffer) {
  try {
    inspectXlsx(buffer);

    const values = await readSheet(buffer, 1, {
      trim: false,
    });

    return validateImportRows(values);
  } catch (error) {
    if (error instanceof ImportError) {
      throw error;
    }

    throw new ImportError(
      "Không đọc được file Excel. Hãy lưu lại dưới dạng .xlsx bằng file mẫu.",
    );
  }
}