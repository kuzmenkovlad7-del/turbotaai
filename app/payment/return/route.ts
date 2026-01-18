import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function extractOrderReference(req: NextRequest) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("orderReference")?.trim();
  if (fromQuery) return fromQuery;

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const j: any = await req.json();
      return String(j?.orderReference || "").trim() || null;
    }

    const text = await req.text();
    const params = new URLSearchParams(text);
    const v = params.get("orderReference");
    return v ? v.trim() : null;
  } catch {
    return null;
  }
}

function redirectToResult(req: NextRequest, orderReference: string | null) {
  const base = new URL(req.url);
  const to = new URL("/payment/result", base.origin);

  if (orderReference) {
    to.searchParams.set("orderReference", orderReference);
  }

  return NextResponse.redirect(to, 302);
}

export async function GET(req: NextRequest) {
  const orderReference = await extractOrderReference(req);
  return redirectToResult(req, orderReference);
}

export async function POST(req: NextRequest) {
  const orderReference = await extractOrderReference(req);
  return redirectToResult(req, orderReference);
}
