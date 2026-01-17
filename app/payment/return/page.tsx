"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PaymentReturnPage() {
  const sp = useSearchParams();
  const orderReference = sp.get("orderReference");

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderReference) {
      setLoading(false);
      setError("Missing orderReference");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      attempts++;

      try {
        const res = await fetch(
          `/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`,
          { cache: "no-store" }
        );

        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok) {
          setError(json?.error || "Failed to check status");
          setLoading(false);
          return;
        }

        const st = json?.status ?? null;
        setStatus(st);
        setLoading(false);

        // если webhook еще не успел — ждём
        if (st !== "paid" && attempts < 25) {
          setTimeout(tick, 1500);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Network error");
        setLoading(false);
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [orderReference]);

  const paid = status === "paid";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Оплата TurbotaAI</h1>

        <p className="mt-2 text-sm text-muted-foreground break-all">
          Заказ: {orderReference || "—"}
        </p>

        {loading && (
          <p className="mt-4 text-sm">
            Проверяем статус оплаты...
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-500">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mt-4 rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Статус</p>
              <p className="mt-1 text-lg font-medium">
                {status || "unknown"}
              </p>
            </div>

            {paid ? (
              <p className="mt-4 text-sm">
                Оплата прошла успешно. Спасибо!
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Если статус не обновился сразу, подождите 10–20 секунд.
                Страница обновляет статус автоматически.
              </p>
            )}
          </>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            На главную
          </Link>

          <button
            onClick={() => window.location.reload()}
            className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium"
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
}
