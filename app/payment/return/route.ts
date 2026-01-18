import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickOrderReference(obj: any): string | null {
  if (!obj) return null;
  return (
    obj.orderReference ||
    obj.order_reference ||
    obj.order_ref ||
    obj.order ||
    null
  );
}

async function parseAnyBody(req: NextRequest): Promise<any> {
  const text = (await req.text()).trim();
  if (!text) return {};

  // 1) если это JSON (часто WayForPay реально шлет просто JSON строкой)
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {}
  }

  // 2) если это обычный x-www-form-urlencoded
  const params = new URLSearchParams(text);
  const obj: Record<string, any> = {};
  params.forEach((v, k) => {
    obj[k] = v;
  });

  // 3) спец-кейс: прилетело одним ключом JSON без "="
  if (Object.keys(obj).length === 1) {
    const onlyKey = Object.keys(obj)[0];
    const onlyVal = obj[onlyKey];

    if (onlyKey && onlyKey.trim().startsWith("{")) {
      try {
        return JSON.parse(onlyKey);
      } catch {}
    }

    if (typeof onlyVal === "string" && onlyVal.trim().startsWith("{")) {
      try {
        return JSON.parse(onlyVal);
      } catch {}
    }
  }

  // 4) иногда кладут JSON в поле data
  if (typeof obj.data === "string" && obj.data.trim().startsWith("{")) {
    try {
      return JSON.parse(obj.data);
    } catch {}
  }

  return obj;
}

// GET: просто кидаем на UI-страницу результата
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderReference =
    url.searchParams.get("orderReference") ||
    url.searchParams.get("order_reference") ||
    "";

  const target = new URL("/payment/result", url.origin);
  if (orderReference) target.searchParams.set("orderReference", orderReference);

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString() },
  });
}

// POST: именно сюда чаще всего возвращает WayForPay (и это давало 405)
export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  let payload: any = {};
  try {
    payload = await parseAnyBody(req);
  } catch {}

  const orderReference =
    url.searchParams.get("orderReference") ||
    url.searchParams.get("order_reference") ||
    pickOrderReference(payload) ||
    "";

  // ВАЖНО: сразу дергаем server-side check, чтобы база обновилась даже если webhook тупит
  if (orderReference) {
    const checkUrl = new URL("/api/billing/wayforpay/check", url.origin);
    checkUrl.searchParams.set("orderReference", orderReference);
    fetch(checkUrl.toString(), { cache: "no-store" }).catch(() => {});
  }

  const target = new URL("/payment/result", url.origin);
  if (orderReference) target.searchParams.set("orderReference", orderReference);

  // 303 гарантированно превращает POST -> GET (иначе можно снова получить 405)
  return new Response(null, {
    status: 303,
    headers: { Location: target.toString() },
  });
}
