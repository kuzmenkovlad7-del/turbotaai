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
    const existing = cookieStore.get("ta_device_hash")?.value ?? null;
    if (existing) return existing;

    const created = crypto.randomUUID();
    pendingCookies.push({
      name: "ta_device_hash",
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

async function upsertProfile(sb: any, user: any) {
  const now = new Date().toISOString();
  const fullName =
    (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null) as string | null;

  const row = {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    created_at: now,
    updated_at: now,
  };

  await sb.from("profiles").upsert(row, { onConflict: "id" });
}

async function ensureAccessGrant(sb: any, userId: string, deviceHash: string) {
  const trial = Number(process.env.TRIAL_QUESTIONS_LIMIT ?? "5");
  const now = new Date().toISOString();

  const { data: byUser } = await sb.from("access_grants").select("*").eq("user_id", userId).maybeSingle();
  if (byUser) return byUser;

  const { data: byDevice } = await sb
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byDevice?.id) {
    const { data: updated } = await sb
      .from("access_grants")
      .update({ user_id: userId, updated_at: now })
      .eq("id", byDevice.id)
      .select("*")
      .single();
    return updated ?? byDevice;
  }

  const { data: created } = await sb
    .from("access_grants")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      device_hash: deviceHash,
      trial_questions_left: trial,
      paid_until: null,
      promo_until: null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  return created ?? null;
}

export async function POST(req: Request) {
  const { sb, json, getOrCreateDeviceHash } = routeSupabase();

  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return json({ ok: false, error: "Email and password are required" }, 400);
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  // ВАЖНО: если неверный пароль — НЕ возвращаем ok:true
  if (error || !data?.session || !data?.user) {
    return json({ ok: false, error: error?.message || "Login failed" }, 400);
  }

  const deviceHash = getOrCreateDeviceHash();

  await ensureAccessGrant(sb, data.user.id, deviceHash);
  await upsertProfile(sb, data.user);

  return json({ ok: true, user: data.user });
}
