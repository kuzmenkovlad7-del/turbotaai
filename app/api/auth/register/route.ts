import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

function supabaseAdminOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertProfile(sb: any, user: any, fullName: string | null) {
  const now = new Date().toISOString();
  const row = {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName ?? null,
    created_at: now,
    updated_at: now,
  };

  await sb.from("profiles").upsert(row, { onConflict: "id" });
}

async function ensureAccessGrant(sb: any, userId: string, deviceHash: string) {
  const trial = Number(process.env.TRIAL_QUESTIONS_LIMIT ?? "5");
  const now = new Date().toISOString();

  // 1) если уже есть grant по user_id -> ок
  const { data: byUser } = await sb.from("access_grants").select("*").eq("user_id", userId).maybeSingle();
  if (byUser) return byUser;

  // 2) если есть guest grant по device_hash -> прикрепляем к юзеру
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

  // 3) иначе создаем новый grant под user_id
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
  const fullNameRaw =
    body?.fullName ?? body?.full_name ?? body?.name ?? body?.full_name_input ?? null;
  const fullName = fullNameRaw ? String(fullNameRaw).trim() : "";

  if (!email || !password) {
    return json({ ok: false, error: "Email and password are required" }, 400);
  }

  const deviceHash = getOrCreateDeviceHash();

  const meta = fullName ? { full_name: fullName, name: fullName } : undefined;

  const { data: signUpData, error: signUpError } = await sb.auth.signUp({
    email,
    password,
    options: { data: meta },
  });

  if (signUpError || !signUpData?.user) {
    return json({ ok: false, error: signUpError?.message || "Sign up failed" }, 400);
  }

  // Если Supabase требует подтверждение email, session будет null
  if (!signUpData.session) {
    const admin = supabaseAdminOrNull();
    if (!admin) {
      return json(
        {
          ok: false,
          error:
            "Email confirmation is enabled in Supabase. Add SUPABASE_SERVICE_ROLE_KEY to env OR disable email confirmations.",
        },
        400
      );
    }

    try {
      await admin.auth.admin.updateUserById(signUpData.user.id, {
        email_confirm: true,
        user_metadata: meta,
      } as any);
    } catch {}

    const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({ email, password });
    if (signInError || !signInData?.session) {
      return json({ ok: false, error: signInError?.message || "Auto login failed after sign up" }, 400);
    }

    await ensureAccessGrant(sb, signInData.user.id, deviceHash);
    await upsertProfile(sb, signInData.user, fullName || null);

    return json({ ok: true, user: signInData.user });
  }

  // session уже есть -> просто привязываем grant
  await ensureAccessGrant(sb, signUpData.user.id, deviceHash);
  await upsertProfile(sb, signUpData.user, fullName || null);

  return json({ ok: true, user: signUpData.user });
}
