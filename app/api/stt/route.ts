import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChunkEntry = {
  createdAt: number;
  total: number;
  mime: string;
  name: string;
  chunks: Map<number, Uint8Array>;
};

const GLOBAL_KEY = "__turbota_stt_chunks__";

function getStore(): Map<string, ChunkEntry> {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, ChunkEntry>();
  return g[GLOBAL_KEY] as Map<string, ChunkEntry>;
}

function now() {
  return Date.now();
}

function cleanupStore(store: Map<string, ChunkEntry>) {
  const TTL_MS = 2 * 60 * 1000; // 2 min
  const t = now();
  store.forEach((v, k) => {
    if (t - v.createdAt > TTL_MS) store.delete(k);
  });
}

function normalizeMime(mime: string) {
  if (!mime) return "";
  return mime.split(";")[0].trim().toLowerCase();
}

function extFromMime(mime: string) {
  const m = normalizeMime(mime);
  if (m === "audio/webm" || m === "video/webm") return "webm";
  if (m === "audio/ogg" || m === "application/ogg") return "ogg";
  if (m === "audio/wav" || m === "audio/wave" || m === "audio/x-wav") return "wav";
  if (m === "audio/mpeg") return "mp3";
  if (m === "audio/mp4" || m === "video/mp4") return "mp4";
  if (m === "audio/x-m4a" || m === "audio/m4a") return "m4a";
  if (m === "audio/flac") return "flac";
  return "webm";
}

function ensureExt(name: string, ext: string) {
  const n = (name || "").trim();
  if (!n) return `audio.${ext}`;
  const lower = n.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return n;
  // если вообще без расширения
  if (!lower.includes(".")) return `${n}.${ext}`;
  // если расширение другое — всё равно подправим под ext (важно для OpenAI)
  return `${n.replace(/\.[a-z0-9]+$/i, "")}.${ext}`;
}

async function callOpenAITranscribe(file: File, language?: string) {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      data: { error: "OPENAI_API_KEY is missing on server" },
    };
  }

  const model = process.env.OPENAI_STT_MODEL || "whisper-1";

  const fd = new FormData();
  fd.append("model", model);
  if (language) fd.append("language", language);
  fd.append("file", file);

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: fd,
  });

  const text = await r.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {}

  return { ok: r.ok, status: r.status, data };
}

async function readAudioFromRequest(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // multipart/form-data
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();

    const fileAny =
      form.get("file") ||
      form.get("audio") ||
      form.get("blob") ||
      form.get("recording");

    const languageAny = form.get("language") || form.get("lang") || form.get("locale");

    const sendIdxAny =
      form.get("sendIdx") ||
      form.get("chunkIndex") ||
      form.get("index");

    const totalChunksAny =
      form.get("totalChunks") ||
      form.get("chunksTotal") ||
      form.get("total");

    const idAny =
      form.get("id") ||
      form.get("requestId") ||
      form.get("uploadId") ||
      form.get("sessionId");

    if (!(fileAny instanceof File)) {
      return {
        kind: "error" as const,
        status: 400,
        body: { success: false, error: "No audio file in form-data (file/audio/blob/recording)" },
      };
    }

    const mimeRaw = fileAny.type || "audio/webm";
    const mime = normalizeMime(mimeRaw);
    const ext = extFromMime(mimeRaw);
    const safeName = ensureExt(fileAny.name || "audio", ext);

    const buf = new Uint8Array(await fileAny.arrayBuffer());
    const size = buf.byteLength;

    const language = typeof languageAny === "string" ? languageAny : undefined;

    const totalChunks = totalChunksAny ? Number(totalChunksAny) : 1;
    const sendIdx = sendIdxAny ? Number(sendIdxAny) : 1;
    const id = typeof idAny === "string" ? idAny : "";

    return {
      kind: "multipart" as const,
      file: fileAny,
      buf,
      size,
      mime,
      safeName,
      language,
      chunking: {
        enabled: Number.isFinite(totalChunks) && totalChunks > 1,
        total: Number.isFinite(totalChunks) ? totalChunks : 1,
        idx1: Number.isFinite(sendIdx) ? sendIdx : 1, // 1-based
        id,
      },
    };
  }

  // raw audio body (Content-Type: audio/*)
  if (ct.startsWith("audio/") || ct.startsWith("video/")) {
    const ab = await req.arrayBuffer();
    const buf = new Uint8Array(ab);
    const mimeRaw = req.headers.get("content-type") || "audio/webm";
    const mime = normalizeMime(mimeRaw);
    const ext = extFromMime(mimeRaw);
    const id = req.headers.get("x-stt-id") || req.headers.get("x-upload-id") || "";
    const idx1 = Number(req.headers.get("x-chunk-idx") || "1");
    const total = Number(req.headers.get("x-chunk-total") || "1");
    const language = req.headers.get("x-stt-lang") || undefined;

    return {
      kind: "raw" as const,
      buf,
      size: buf.byteLength,
      mime,
      safeName: ensureExt("audio", ext),
      language,
      chunking: {
        enabled: Number.isFinite(total) && total > 1,
        total: Number.isFinite(total) ? total : 1,
        idx1: Number.isFinite(idx1) ? idx1 : 1,
        id,
      },
    };
  }

  return {
    kind: "error" as const,
    status: 415,
    body: { success: false, error: "Unsupported Content-Type for /api/stt" },
  };
}

export async function POST(req: Request) {
  try {
    const store = getStore();
    cleanupStore(store);

    const parsed = await readAudioFromRequest(req);

    if (parsed.kind === "error") {
      return NextResponse.json(parsed.body, { status: parsed.status });
    }

    if (parsed.size <= 0) {
      return NextResponse.json(
        { success: false, error: "Empty audio buffer" },
        { status: 400 },
      );
    }

    const { chunking } = (parsed as any);

    // --- chunked upload ---
    if (chunking?.enabled) {
      const total = Math.max(1, Number(chunking.total || 1));
      const idx1 = Math.max(1, Number(chunking.idx1 || 1));
      const idx0 = idx1 - 1;

      const id = (chunking.id || "").trim();
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Missing chunk upload id (id/requestId/uploadId/sessionId)" },
          { status: 400 },
        );
      }

      const key = id;

      let entry = store.get(key);
      if (!entry) {
        entry = {
          createdAt: now(),
          total,
          mime: (parsed as any).mime,
          name: (parsed as any).safeName,
          chunks: new Map<number, Uint8Array>(),
        };
        store.set(key, entry);
      }

      // если total поменялся — синхронизируем на последний (на всякий)
      entry.total = total;
      entry.mime = (parsed as any).mime || entry.mime;
      entry.name = (parsed as any).safeName || entry.name;

      entry.chunks.set(idx0, (parsed as any).buf);

      if (entry.chunks.size < total) {
        return NextResponse.json({
          success: true,
          partial: true,
          received: entry.chunks.size,
          total,
        });
      }

      // assemble
      const bufs: Uint8Array[] = [];
      let totalSize = 0;

      for (let i = 0; i < total; i++) {
        const b = entry.chunks.get(i);
        if (!b) {
          return NextResponse.json(
            { success: false, error: `Missing chunk ${i + 1}/${total}` },
            { status: 400 },
          );
        }
        bufs.push(b);
        totalSize += b.byteLength;
      }

      store.delete(key);

      const merged = new Uint8Array(totalSize);
      let offset = 0;
      for (const b of bufs) {
        merged.set(b, offset);
        offset += b.byteLength;
      }

      const ext = extFromMime(entry.mime);
      const mime = normalizeMime(entry.mime);
      const filename = ensureExt(entry.name || "audio", ext);

      const file = new File([merged], filename, { type: mime || "audio/webm" });

      const res = await callOpenAITranscribe(file, (parsed as any).language);

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: "OpenAI STT failed", details: res.data },
          { status: res.status || 500 },
        );
      }

      const text = (res.data && (res.data.text || res.data.transcript)) || "";
      return NextResponse.json({ success: true, text });
    }

    // --- single upload ---
    const mime = normalizeMime((parsed as any).mime || "audio/webm");
    const ext = extFromMime((parsed as any).mime || "audio/webm");
    const filename = ensureExt((parsed as any).safeName || "audio", ext);
    const file = new File([(parsed as any).buf], filename, { type: mime || "audio/webm" });

    const res = await callOpenAITranscribe(file, (parsed as any).language);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "OpenAI STT failed", details: res.data },
        { status: res.status || 500 },
      );
    }

    const text = (res.data && (res.data.text || res.data.transcript)) || "";
    return NextResponse.json({ success: true, text });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: "STT failed", details: e?.message || String(e) },
      { status: 500 },
    );
  }
}
