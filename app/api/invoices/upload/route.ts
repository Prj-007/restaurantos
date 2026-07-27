import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { extractInvoice } from "@/lib/gemini";
import { saveUploadedFile } from "@/lib/storage";

// Accepts one or more files, runs each through Gemini, and returns a draft
// extraction per file. Nothing is written to the database here — the user
// reviews/corrects the draft in the UI and confirms via POST /api/invoices.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const [fileUrl, extraction] = await Promise.all([
          saveUploadedFile(buffer, file.name, file.type || "application/octet-stream"),
          extractInvoice(buffer, file.type || "application/octet-stream"),
        ]);
        return { fileName: file.name, fileUrl, extraction, error: null as string | null };
      } catch (err) {
        return {
          fileName: file.name,
          fileUrl: null,
          extraction: null,
          error: err instanceof Error ? err.message : "Extraction failed",
        };
      }
    })
  );

  return NextResponse.json({ results });
}
