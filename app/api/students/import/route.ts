import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  sheets,
  spreadsheetId,
} from "@/lib/google-sheets";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

import {
  cell,
  ImportError,
  MAX_IMPORT_BYTES,
} from "@/lib/student-import";

import {
  parseStudentWorkbook,
} from "@/lib/student-import-excel";

import {
  runStudentImport,
  serializeStudentImport,
  type ImportInput,
} from "@/lib/student-import-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
};

// Đọc FormData nhưng giới hạn tổng dung lượng request.
async function limitedFormData(request: Request) {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.startsWith("multipart/form-data;")) {
    throw new ImportError(
      "Yêu cầu tải file không hợp lệ.",
    );
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new ImportError(
      "Chưa chọn file Excel.",
    );
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) {
        break;
      }

      totalSize += part.value.byteLength;

      // Cho phép thêm một ít dung lượng cho thông tin FormData.
      if (
        totalSize >
        MAX_IMPORT_BYTES + 64 * 1024
      ) {
        await reader.cancel();

        throw new ImportError(
          "File Excel không được vượt quá 2 MB.",
          413,
        );
      }

      chunks.push(new Uint8Array(part.value));
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const body = new Blob(chunks);

    return await new Response(body, {
      headers: {
        "Content-Type": contentType,
      },
    }).formData();
  } catch {
    throw new ImportError(
      "Không đọc được file đã tải lên.",
    );
  }
}

export async function POST(request: Request) {
  try {
    /*
     * Chặn request không xuất phát từ giao diện của hệ thống.
     * Giao diện ở bước sau sẽ gửi header này.
     */
    const origin = request.headers.get("origin");

    if (
      request.headers.get("x-giaoly-import") !== "1" ||
      (
        origin &&
        origin !== new URL(request.url).origin
      )
    ) {
      throw new ImportError(
        "Yêu cầu không hợp lệ. Hãy tải lại trang.",
        403,
      );
    }

    // 1. Lấy cookie đăng nhập.
    const cookieStore = await cookies();

    const sessionToken =
      cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      throw new ImportError(
        "Bạn chưa đăng nhập.",
        401,
        "UNAUTHORIZED",
      );
    }

    // 2. Kiểm tra JWT và lấy account_id.
    let accountId = "";

    try {
      const session =
        await verifySessionToken(sessionToken);

      accountId = cell(session.sub);
    } catch {
      throw new ImportError(
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
        401,
        "UNAUTHORIZED",
      );
    }

    if (!accountId) {
      throw new ImportError(
        "Phiên đăng nhập không hợp lệ.",
        401,
        "UNAUTHORIZED",
      );
    }

    // 3. Đọc dữ liệu từ FormData.
    const form = await limitedFormData(request);

    const action = form.get("action");
    const classId = cell(form.get("classId"));
    const schoolYear = cell(form.get("schoolYear"));
    const file = form.get("file");

    if (
      (action !== "preview" &&
        action !== "commit") ||
      !classId ||
      classId.length > 100 ||
      !schoolYear ||
      schoolYear.length > 40
    ) {
      throw new ImportError(
        "Hãy chọn lớp và niên khóa hợp lệ.",
      );
    }

    // 4. Kiểm tra file.
    if (
      !(file instanceof File) ||
      !/\.xlsx$/i.test(file.name)
    ) {
      throw new ImportError(
        "Chỉ nhận file Excel .xlsx.",
      );
    }

    if (
      !file.size ||
      file.size > MAX_IMPORT_BYTES
    ) {
      throw new ImportError(
        "File Excel phải có dữ liệu và không vượt quá 2 MB.",
        413,
      );
    }

    const buffer = Buffer.from(
      await file.arrayBuffer(),
    );

    /*
     * Dấu vân tay của file.
     * Dùng để đảm bảo file xác nhận chính là file đã xem trước.
     */
    const fingerprint = createHash("sha256")
      .update(buffer)
      .digest("hex");

    const previewFingerprint = cell(
      form.get("fingerprint"),
    );

    if (
      action === "commit" &&
      previewFingerprint !== fingerprint
    ) {
      throw new ImportError(
        "File đã thay đổi. Hãy xem trước lại trước khi xác nhận.",
      );
    }

    // 5. Đọc và kiểm tra nội dung Excel.
    const rows =
      await parseStudentWorkbook(buffer);

    const input: ImportInput = {
      action,
      accountId,
      classId,
      schoolYear,
      fingerprint,
      rows,
    };

    /*
     * Hàm đọc Google Sheets và lưu học viên.
     * Được truyền vào service để tách logic xử lý khỏi API.
     */
    const performImport = () =>
      runStudentImport(input, {
        loadTables: async () => {
          const response =
            await sheets.spreadsheets.values.batchGet({
              spreadsheetId,
              ranges: [
                "ACCOUNT!A2:J",
                "TEACHER!A2:F",
                "CLASS!A2:J",
                "TEACHER_CLASS!A2:G",
                "STUDENT!A1:K",
              ],
            });

          return (
            response.data.valueRanges ?? []
          ).map(
            (range) => range.values ?? [],
          );
        },

        append: async (values) => {
          const response =
            await sheets.spreadsheets.values.append(
              {
                spreadsheetId,
                range: "STUDENT!A:K",
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: {
                  majorDimension: "ROWS",
                  values,
                },
              },
              {
                // Không tự gửi lại request append.
                retry: false,
                timeout: 20000,
              },
            );

          if (
            response.data.updates?.updatedRows !==
            values.length
          ) {
            throw new Error(
              "Không xác nhận được số dòng đã lưu.",
            );
          }
        },
      });

    /*
     * Chỉ cần xếp hàng khi thực sự xác nhận lưu.
     * Xem trước không làm thay đổi Google Sheets.
     */
    const result =
      action === "commit"
        ? await serializeStudentImport(
            performImport,
          )
        : await performImport();

    return NextResponse.json(result, {
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          code: error.code,
        },
        {
          status: error.status,
          headers: responseHeaders,
        },
      );
    }

    console.error(
      "STUDENT_IMPORT_FAILED",
      error instanceof Error
        ? error.name
        : "UnknownError",
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể xử lý danh sách học viên. Vui lòng thử lại.",
      },
      {
        status: 500,
        headers: responseHeaders,
      },
    );
  }
}