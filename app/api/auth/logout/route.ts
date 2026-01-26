import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getOrigin(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const origin = getOrigin(req);

  const res = NextResponse.redirect(new URL("/login", origin), { status: 302 });

  // Жёсткая очистка (работает именно на top-level navigation)
  res.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
  res.headers.set("cache-control", "no-store");

  // Снести ВСЕ cookies, включая supabase/ta_*
  const all = cookies().getAll();
  for (const c of all) {
    res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    res.cookies.set(c.name, "", { path: "/", maxAge: 0, domain: ".turbotaai.com" });
    res.cookies.set(c.name, "", { path: "/", maxAge: 0, domain: "turbotaai.com" });
  }

  return res;
}
