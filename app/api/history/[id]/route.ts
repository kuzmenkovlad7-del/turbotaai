import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

  return { sb, json, getOrCreateDeviceHash };
}

export async function GET(_: Request, ctx: any) {
  const { sb, json, getOrCreateDeviceHash } = routeSupabase();
  const id = String(ctx?.params?.id ?? "").trim();
  if (!id) return json({ ok: false, error: "Missing id" }, 400);

  const deviceHash = getOrCreateDeviceHash();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user ?? null;

  const { data: conv } = await sb.from("conversations").select("*").eq("id", id).maybeSingle();
  if (!conv) return json({ ok: false, error: "Not found" }, 404);

  const allowed =
    (user && conv.user_id === user.id) ||
    (!user && conv.user_id == null && conv.device_hash === deviceHash) ||
    (user && conv.user_id == null && conv.device_hash === deviceHash);

  if (!allowed) return json({ ok: false, error: "Forbidden" }, 403);

  // ВАЖНО: в твоей БД колонка называется text, НЕ content
  const { data: msgs, error } = await sb
    .from("messages")
    .select("id,role,text,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return json({ ok: false, error: error.message }, 400);

  // фронт ожидает content -> отдаем совместимо
  const mapped = (msgs ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.text,
    created_at: m.created_at,
  }));

  return json({ ok: true, conversation: conv, messages: mapped });
}
