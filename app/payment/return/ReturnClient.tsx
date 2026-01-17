"use client";

import { useEffect, useMemo, useState } from "react";

type Status = string | null;

export default function ReturnClient({ orderReference }: { orderReference: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  const safeOrderRef = useMemo(() => orderReference || "", [orderReference]);

  async function loadStatus() {
    if (!safeOrderRef) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/billing/orders/status?orderReference=${encodeURIComponent(safeOrderRef)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setStatus(json?.status ?? null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!safeOrderRef) return;

    loadStatus();
    const t = setInterval(loadStatus, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeOrderRef]);

  const isPaid = status === "paid";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 560, width: "100%", background: "#111", border: "1px solid #222", borderRadius: 16, padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>
          {isPaid ? "Оплата успешно прошла" : "Проверяем оплату"}
        </h1>

        <p style={{ opacity: 0.85, marginBottom: 16 }}>
          OrderReference: <span style={{ opacity: 1 }}>{safeOrderRef || "не найден"}</span>
        </p>

        <div style={{ padding: 12, borderRadius: 12, background: "#0b0b0b", border: "1px solid #222" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>Статус:</strong>
            <span>{loading ? "обновляем..." : status || "нет данных"}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={loadStatus}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333", background: "#151515", color: "#fff", cursor: "pointer" }}
          >
            Обновить
          </button>

          <a
            href="/"
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333", background: "#151515", color: "#fff", textDecoration: "none" }}
          >
            На главную
          </a>
        </div>

        {!isPaid && (
          <p style={{ marginTop: 16, opacity: 0.75 }}>
            Если оплата уже прошла, обычно webhook обновляет статус за 1–10 секунд.
          </p>
        )}
      </div>
    </div>
  );
}
