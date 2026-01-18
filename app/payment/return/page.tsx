"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type State = "checking" | "paid" | "processing" | "failed" | "error";

export default function PaymentReturnPage() {
  const params = useSearchParams();
  const orderReference = params.get("orderReference") || "";

  const [state, setState] = useState<State>("checking");
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (!orderReference) {
      setState("error");
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const r = await fetch("/api/billing/wayforpay/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderReference }),
        });

        const j = await r.json();
        if (cancelled) return;

        setDetails(j);

        const dbStatus = j?.db?.status || "";
        const wfpStatus = j?.wayforpay?.transactionStatus || "";
        const s = String(dbStatus || wfpStatus).toLowerCase();

        if (s === "paid" || s === "approved") setState("paid");
        else if (s === "processing" || s === "inprocessing" || s === "pending")
          setState("processing");
        else if (s) setState("failed");
        else setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    run();

    const t = setInterval(run, 3000);
    const stop = setTimeout(() => clearInterval(t), 30000);

    return () => {
      cancelled = true;
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [orderReference]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 text-white">
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
