import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type IncomingMsg = {
  role?: string;
  content?: string;
  text?: string;
  created_at?: string;
};

function routeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = cookies();
  const pendingCookies: any[] = [];

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const getOrCreateDeviceHash = () => {
    const existing = cookieStore.get("turbotaai_device")?.value ?? null;
    if (existing) return existing;

    const created = crypto.randomUUID();
    pendingCookies.push({
      name: "turbotaai_device",
      value: created,
      options: {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      },
    });
    return created;
  };

  const json = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status });
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("cache-control", "no-store, max-age=0");
    return res;
  };

  return { sb, json, cookieStore, getOrCreateDeviceHash };
}

function normalizeMessages(body: any): IncomingMsg[] {
  // 1) основной формат: messages / message / history
  if (Array.isArray(body?.messages) && body.messages.length) {
    return body.messages.map((m: any) => m ?? {});
  }
  if (body?.message) return [body.message ?? {}];
  if (Array.isArray(body?.history) && body.history.length) {
    return body.history.map((m: any) => m ?? {});
  }

  // 2) поддержка твоего header.tsx (userText / assistantText)
  const arr: IncomingMsg[] = [];
  const u = typeof body?.userText === "string" ? body.userText.trim() : "";
  const a = typeof body?.assistantText === "string" ? body.assistantText.trim() : "";
  if (u) arr.push({ role: "user", content: u });
  if (a) arr.push({ role: "assistant", content: a });
  return arr;
}

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  // если прилетает JSON-строка типа [{"output":"..."}] — вытаскиваем output
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      const parsed: any = JSON.parse(s);

      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (x) => x && typeof x === "object" && (typeof x.output === "string" || typeof x.text === "string")
        );
        const out = first?.output ?? first?.text ?? first?.content ?? first?.message ?? null;
        if (typeof out === "string" && out.trim()) return out.trim();
      }

      if (parsed && typeof parsed === "object") {
        const out = parsed.output ?? parsed.text ?? parsed.content ?? parsed.message ?? null;
        if (typeof out === "string" && out.trim()) return out.trim();
      }
    } catch {}
  }

  return s;
}

function buildTitle(messages: IncomingMsg[]) {
  const firstUser = messages.find((m) => String(m?.role ?? "") === "user");
  const raw = cleanText(firstUser?.content ?? firstUser?.text ?? "");
  if (!raw) return null;
  return raw.length > 64 ? raw.slice(0, 64) + "…" : raw;
}

export async function POST(req: Request) {
  const { sb, json, getOrCreateDeviceHash } = routeSupabase();

  const body = await req.json().catch(() => ({} as any));
  const mode = String(body?.mode ?? "chat").trim() || "chat";

  const incoming = normalizeMessages(body);

  const requestedIdRaw =
    body?.conversationId ?? body?.conversation_id ?? body?.id ?? body?.conversation?.id ?? null;
  const requestedId = requestedIdRaw ? String(requestedIdRaw).trim() : null;

  const now = new Date().toISOString();
  const deviceHash = getOrCreateDeviceHash();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user ?? null;

  const principalUserId = user?.id ?? null;
  const principalDeviceHash = principalUserId ? null : deviceHash;

  let convId = requestedId || crypto.randomUUID();

  // проверяем доступ к беседе если она уже есть
  const { data: existingConv } = await sb
    .from("conversations")
    .select("id,user_id,device_hash,title")
    .eq("id", convId)
    .maybeSingle();

  if (existingConv) {
    const allowed =
      (principalUserId && existingConv.user_id === principalUserId) ||
      (!principalUserId &&
        existingConv.user_id == null &&
        existingConv.device_hash &&
        existingConv.device_hash === deviceHash) ||
      (principalUserId &&
        existingConv.user_id == null &&
        existingConv.device_hash &&
        existingConv.device_hash === deviceHash);

    if (!allowed) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
  }

  // title ставим только если его еще нет
  const titleAuto = buildTitle(incoming);
  const titleFromBody = typeof body?.title === "string" ? body.title.trim() : null;
  const titleToSet = titleFromBody || (existingConv?.title ? null : titleAuto) || null;

  const convRow: any = {
    id: convId,
    user_id: principalUserId,
    device_hash: principalDeviceHash,
    mode,
    title: titleToSet,
    created_at: existingConv ? undefined : now,
    updated_at: now,
  };

  Object.keys(convRow).forEach((k) => convRow[k] === undefined && delete convRow[k]);
  if (!convRow.title) delete convRow.title;

  const { error: convErr } = await sb.from("conversations").upsert(convRow, { onConflict: "id" });
  if (convErr) return json({ ok: false, error: convErr.message }, 400);

  if (!incoming.length) {
    return json({ ok: true, id: convId, conversationId: convId });
  }

  // ВАЖНО: НЕ удаляем старые сообщения, а ДОБАВЛЯЕМ новые (иначе история исчезает)
  const rows = incoming
    .map((m) => {
      const role = String(m?.role ?? "").trim() || "assistant";
      const text = cleanText(m?.content ?? m?.text ?? "");
      if (!text) return null;

      return {
        conversation_id: convId,
        user_id: principalUserId,
        role,
        text,
        created_at: m?.created_at ? String(m.created_at) : now,
      };
    })
    .filter(Boolean) as any[];

  if (!rows.length) {
    return json({ ok: true, id: convId, conversationId: convId });
  }

  const { error: msgErr } = await sb.from("messages").insert(rows);
  if (msgErr) return json({ ok: false, error: msgErr.message }, 400);

  return json({ ok: true, id: convId, conversationId: convId });
}
