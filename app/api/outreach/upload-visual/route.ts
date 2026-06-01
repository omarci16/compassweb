import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const BUCKET = "outreach-visuals";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/**
 * Accepts a multipart/form-data file upload + a lead_id, stores it in the
 * public outreach-visuals bucket, and returns the public URL the modal can
 * use both for the live preview and the rendered HTML email.
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const leadId = form.get("lead_id");
  const file = form.get("file");

  if (typeof leadId !== "string" || !leadId) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 413 },
    );
  }

  const supabase = createServiceClient();
  const ext = file.type.split("/")[1] ?? "png";
  const path = `${leadId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    console.error("outreach visual upload failed", uploadError);
    return NextResponse.json(
      { error: "Upload failed", detail: uploadError.message },
      { status: 500 },
    );
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    path,
    public_url: publicData.publicUrl,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });
}
