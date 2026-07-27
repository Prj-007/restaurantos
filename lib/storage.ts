import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Vercel's filesystem is read-only/ephemeral at runtime, so uploaded invoice
// files must go to Vercel Blob in production. Locally (no blob token yet)
// we fall back to writing into /public/uploads so the app still works
// end-to-end before the Vercel Blob store is provisioned.
export async function saveUploadedFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const key = `invoices/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buffer, { access: "public", contentType: mimeType });
    return blob.url;
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "invoices");
  await mkdir(uploadDir, { recursive: true });
  const localName = key.split("/").pop() as string;
  await writeFile(path.join(uploadDir, localName), buffer);
  return `/uploads/invoices/${localName}`;
}
