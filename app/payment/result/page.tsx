"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type State = "checking" | "processing" | "paid" | "failed" | "error";

export default function PaymentResultPage() {
  const sp = useSearchParams();
  const orderReference = sp.get("orderReference") || "";

  const [state, setState] = useState<State>("checking");
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!orderReference) {
        setState("error");
        setDetails({ ok: false, error: "missing_orderReference" });
        return;
      }

      try {
        setState("checking");

        // 1) Сразу делаем CHECK_STATUS (он же обновит Supabase)
        const res = await fetch(
          `/api/billing/wayforpay/check?orderReference=${encodeURIComponent(orderReference)}`,
          { cache: "no-store" }
        );

        const json = await res.json().catch(() => null);

        if (cancelled) return;
        setDetails(json);

        const status =
          json?.db?.status ||
          json?.status ||
          json?.wayforpay?.transactionStatus ||
          "";

        if (status === "paid") setState("paid");
        else if (status === "processing") setState("processing");
        else if (status === "failed") setState("failed");
        else setState("error");
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setDetails({ ok: false, error: "check_failed", message: String(e?.message || e) });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orderReference]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-semibold">Оплата</h1>

        <div className="mt-2 text-xs text-white/60 break-all">
          orderReference: {orderReference || "—"}
        </div>

        {state === "checking" && (
          <div className="mt-4 text-sm">Проверяем статус оплаты…</div>
        )}
        {state === "processing" && (
          <div className="mt-4 text-sm">
            Платёж в обработке. Обновляем статус…
          </div>
        )}
        {state === "paid" && (
          <div className="mt-4 text-sm">
            Оплата подтверждена. Доступ активирован.
          </div>
        )}
        {state === "failed" && (
          <div className="mt-4 text-sm">
            Платёж не подтвержден. Если деньги списались, напишите в поддержку.
          </div>
        )}
        {state === "error" && (
          <div className="mt-4 text-sm">
            Не удалось проверить статус. Обновите страницу через 10 секунд.
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <a
            href="/"
            className="flex-1 rounded-xl bg-white text-black px-4 py-2 text-center font-medium"
          >
            На главную
          </a>
          <a
            href="/dashboard"
            className="flex-1 rounded-xl border border-white/20 px-4 py-2 text-center"
          >
            В кабинет
          </a>
        </div>

        {details && (
          <pre className="mt-6 text-[11px] bg-black/40 p-3 rounded-xl overflow-auto max-h-56">
{JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
