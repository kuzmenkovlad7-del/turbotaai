"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

type UiStatus = "checking" | "paid" | "failed" | "processing" | "not_found" | "error";

export default function PaymentResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderReference = useMemo(() => {
    return (searchParams.get("orderReference") || "").trim();
  }, [searchParams]);

  const [status, setStatus] = useState<UiStatus>("checking");
  const [loading, setLoading] = useState(false);

  const autoCheckDoneRef = useRef(false);

  const goHome = () => router.push("/");
  const goProfile = () => router.push("/profile");

  const fetchStatus = async () => {
    if (!orderReference) {
      setStatus("error");
      return;
    }

    try {
      const r = await fetch(
        `/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`,
        { cache: "no-store" }
      );
      const j = await r.json().catch(() => null);

      const next = (j?.status as UiStatus) || "processing";
      if (j?.ok) {
        setStatus(next);
      } else {
        setStatus("processing");
      }
    } catch {
      setStatus("error");
    }
  };

  const forceCheck = async () => {
    if (!orderReference) return;

    setLoading(true);
    try {
      await fetch(
        `/api/billing/wayforpay/check?orderReference=${encodeURIComponent(orderReference)}`,
        { cache: "no-store" }
      );
    } catch {
      // ignore - status will show error if needed
    } finally {
      await fetchStatus();
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // ✅ один авто-check, без интервалов и спама
    const t = setTimeout(async () => {
      if (autoCheckDoneRef.current) return;
      autoCheckDoneRef.current = true;

      // если статус еще не paid — делаем один check
      await forceCheck();
    }, 800);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderReference]);

  const title =
    status === "paid"
      ? "Оплата подтверждена"
      : status === "failed"
      ? "Оплата не прошла"
      : status === "processing" || status === "checking"
      ? "Проверяем оплату"
      : status === "not_found"
      ? "Оплата не найдена"
      : "Ошибка проверки";

  const subtitle =
    status === "paid"
      ? "Доступ активирован. Можете переходить в кабинет."
      : status === "failed"
      ? "Оплата не подтверждена. Попробуйте ещё раз или обратитесь в поддержку."
      : status === "processing" || status === "checking"
      ? "Это может занять несколько секунд."
      : status === "not_found"
      ? "Не удалось найти заказ. Проверьте ссылку или повторите проверку."
      : "Не удалось проверить статус. Повторите попытку.";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {status === "paid" ? (
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            ) : status === "failed" ? (
              <XCircle className="h-7 w-7 text-red-600" />
            ) : (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-xl font-semibold text-card-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

            {orderReference ? (
              <p className="mt-2 text-xs text-muted-foreground/70">
                orderReference: {orderReference}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button className="flex-1" onClick={goProfile}>
            В кабинет
          </Button>
          <Button variant="outline" className="flex-1" onClick={goHome}>
            На главную
          </Button>
        </div>

        <Button
          variant="ghost"
          className="mt-3 w-full gap-2"
          onClick={forceCheck}
          disabled={loading}
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
