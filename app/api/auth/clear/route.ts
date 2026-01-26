import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/api/auth/logout";
  url.search = "";
  return NextResponse.redirect(url, { status: 302 });
}

export async function POST(req: Request) {
  return GET(req);
}
