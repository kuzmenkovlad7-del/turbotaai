"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

type BillingStatus = "paid" | "failed" | "processing" | "invoice_created" | "not_found";

function normStatus(s: any): BillingStatus {
  if (s === "paid" || s === "failed" || s === "processing" || s === "invoice_created" || s === "not_found") return s;
  return "processing";
}

export default function PaymentResultPage() {
  const sp = useSearchParams();
  const orderReference = (sp.get("orderReference") || "").trim();
  const debug = sp.get("debug") === "1";

  const [status, setStatus] = useState<BillingStatus>("processing");
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const pollsRef = useRef(0);
  const stoppedRef = useRef(false);

  const fetchStatus = async () => {
    if (!orderReference) return;

    try {
      const r = await fetch(`/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}${debug ? "&debug=1" : ""}`, {
        cache: "no-store",
      });
      const j: any = await r.json();

      if (!j?.ok) {
        setStatus("failed");
        return;
      }

      setStatus(normStatus(j.status));
      setLastTx(j.lastTransactionStatus || null);

      console.info("[payment-result] status", j);
    } catch (e) {
      console.warn("[payment-result] fetchStatus error", e);
    }
  };

  const forceCheck = async () => {
    if (!orderReference) return;

    setLoading(true);
    try {
      const r = await fetch(`/api/billing/wayforpay/check?orderReference=${encodeURIComponent(orderReference)}`, {
        cache: "no-store",
      });
      const j: any = await r.json().catch(() => null);
      console.info("[payment-result] forceCheck", j);
    } catch (e) {
      console.warn("[payment-result] forceCheck error", e);
    } finally {
      setLoading(false);
      await fetchStatus();
    }
  };

  useEffect(() => {
    if (!orderReference) {
      setStatus("failed");
      return;
    }

    pollsRef.current = 0;
    stoppedRef.current = false;

    fetchStatus();
  }, [orderReference]);

  useEffect(() => {
    if (!orderReference) return;
    if (stoppedRef.current) return;

    if (status === "paid" || status === "failed") {
      stoppedRef.current = true;
      return;
    }

    if (pollsRef.current >= 5) return;
    pollsRef.current += 1;

    const t = setTimeout(() => {
      fetchStatus();
    }, 2000);

    return () => clearTimeout(t);
  }, [status, orderReference]);

  const ui = useMemo(() => {
    if (status === "paid") {
      return {
        title: "Оплата прошла успешно",
        subtitle: "Доступ активирован. Можно переходить в кабинет.",
        icon: <CheckCircle2 className="h-7 w-7 text-green-600" />,
      };
    }

    if (status === "failed") {
      return {
        title: "Оплата не прошла",
        subtitle: "Оплата не подтверждена. Если списание было — нажмите Проверить ещё раз.",
        icon: <XCircle className="h-7 w-7 text-red-600" />,
      };
    }

    return {
      title: "Проверяем оплату",
      subtitle: "Подождите пару секунд. Если не обновится — нажмите Проверить ещё раз.",
      icon: <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />,
    };
  }, [status]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{ui.icon}</div>

          <div className="flex-1">
            <h1 className="text-xl font-semibold text-card-foreground">{ui.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{ui.subtitle}</p>

            {orderReference ? (
              <p className="mt-2 text-xs text-muted-foreground/70">
                orderReference: {orderReference}
                {lastTx ? ` · tx: ${lastTx}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button asChild className="flex-1">
            <Link href="/profile">В кабинет</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">На главную</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          className="mt-3 w-full gap-2"
          onClick={forceCheck}
          disabled={loading || !orderReference}
        >
          <RefreshCw className="h-4 w-4" />
          {loading ? "Проверяем..." : "Проверить ещё раз"}
        </Button>

        <div className="mt-5 text-center text-xs text-muted-foreground">
          support@turbotaai.com
        </div>
      </div>
    </div>
  );
}
