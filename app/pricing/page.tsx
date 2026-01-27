"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Summary = any;
type PromoState = "idle" | "loading" | "ok" | "error";

function formatUAH(value: number) {
  try {
    return new Intl.NumberFormat("uk-UA").format(value);
  } catch {
    return String(value);
  }
}

function promoErrorMessage(code: string) {
  const c = (code || "").toUpperCase().trim();

  if (c === "LOGIN_REQUIRED") return "Щоб активувати промокод, потрібно увійти або зареєструватись.";
  if (c === "EMPTY_CODE") return "Введіть промокод.";
  if (c === "INVALID_PROMO") return "Промокод недійсний або вже неактивний.";
  if (c === "REDEEM_FAILED") return "Не вдалося активувати промокод. Спробуйте ще раз.";
  return "Не вдалося активувати промокод. Спробуйте ще раз.";
}

export default function PricingPage() {
  const [promo, setPromo] = useState("");
  const [promoState, setPromoState] = useState<PromoState>("idle");
  const [promoMsg, setPromoMsg] = useState<string>("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const monthlyPrice = useMemo(() => {
    const v =
      Number((process.env.NEXT_PUBLIC_TA_MONTHLY_PRICE_UAH || "").toString()) ||
      Number((process.env.NEXT_PUBLIC_MONTHLY_PRICE_UAH || "").toString()) ||
      499;
    return v;
  }, []);

  const monthlyPriceLabel = useMemo(() => {
    return formatUAH(monthlyPrice);
  }, [monthlyPrice]);

  const isLoggedIn = useMemo(() => {
    const v =
      summary?.isLoggedIn ??
      summary?.loggedIn ??
      summary?.logged_in ??
      summary?.user?.id ??
      summary?.user_id ??
      summary?.email ??
      null;
    return Boolean(v);
  }, [summary]);

  const access = useMemo<"Paid" | "Promo" | "Trial">(() => {
    const a = String(summary?.access || "").trim();
    if (a === "Paid" || a === "Promo" || a === "Trial") return a as any;

    const paidLike =
      summary?.isPaid ??
      summary?.paid ??
      summary?.subscription?.active ??
      summary?.subscriptionActive ??
      (summary?.plan === "paid");

    return paidLike ? "Paid" : "Trial";
  }, [summary]);

  const trialLeft = useMemo(() => {
    const n =
      summary?.trialLeft ??
      summary?.trial_left ??
      summary?.trial_questions_left ??
      summary?.questionsLeft ??
      summary?.questions_left ??
      summary?.remainingQuestions ??
      summary?.remaining_questions ??
      summary?.limits?.questionsLeft ??
      null;

    const v = Number(n);
    return Number.isFinite(v) ? v : 5;
  }, [summary]);

  const unlimited = useMemo(() => {
    const u = Boolean(summary?.unlimited);
    return u || access === "Paid" || access === "Promo";
  }, [summary, access]);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const r = await fetch("/api/account/summary", {
        cache: "no-store",
        credentials: "include",
      });
      const j = await r.json().catch(() => null);
      setSummary(j);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();

    const onRefresh = () => loadSummary();
    window.addEventListener("turbota:refresh", onRefresh);

    return () => {
      window.removeEventListener("turbota:refresh", onRefresh);
    };
  }, []);

  async function doLogout() {
    try {
      await fetch(`/api/auth/clear?next=${encodeURIComponent("/pricing")}`, { method: "POST" });
    } catch {}
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
      }
    } catch {}
    try {
      sessionStorage.removeItem("turbota_paywall");
      sessionStorage.removeItem("turbota_conv_id");
    } catch {}
    window.dispatchEvent(new Event("turbota:refresh"));
    window.location.assign("/pricing");
  }

  async function redeemPromo() {
    const code = promo.trim();
    if (!code) return;

    if (!isLoggedIn) {
      setPromoState("error");
      setPromoMsg("Щоб активувати промокод, потрібно увійти або зареєструватись.");
      return;
    }

    setPromoState("loading");
    setPromoMsg("");

    try {
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });

      const j: any = await r.json().catch(() => ({}));

      if (j?.ok) {
        setPromoState("ok");
        setPromoMsg("Промокод активовано. Доступ відкрито.");
        setPromo("");
        window.dispatchEvent(new Event("turbota:refresh"));
        await loadSummary();
        return;
      }

      setPromoState("error");
      setPromoMsg(promoErrorMessage(String(j?.errorCode || "")));
    } catch {
      setPromoState("error");
      setPromoMsg("Не вдалося активувати промокод. Спробуйте ще раз.");
    }
  }

  const accessLabel = summaryLoading
    ? "…"
    : unlimited
    ? access === "Promo"
      ? "Промо активне"
      : "Підписка активна"
    : "Безкоштовно";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Тарифи</h1>
        <p className="mt-2 text-muted-foreground">
          Безлімітний доступ до чату, голосу і відео. Пробний режим має ліміт запитань.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl">Щомісяця</CardTitle>
            <CardDescription>Безлімітний доступ до чату, голосу і відео</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-end gap-3">
              <div className="text-6xl font-semibold leading-none">{monthlyPriceLabel}</div>
              <div className="pb-1 text-sm text-muted-foreground">UAH</div>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Безлімітна кількість запитів</li>
              <li>• Чат, голос і відео</li>
              <li>• Історія зберігається у профілі</li>
            </ul>

            <button
              id="turbota-subscribe"
              className="group relative w-full overflow-hidden rounded-2xl border bg-slate-950 p-6 text-left text-white"
              onClick={() => window.location.assign("/api/billing/wayforpay/purchase?planId=monthly")}
            >
              <div className="absolute inset-0 opacity-70">
                <div className="absolute -left-24 -top-24 h-60 w-60 rounded-full bg-indigo-500 blur-3xl" />
                <div className="absolute -right-24 -bottom-24 h-60 w-60 rounded-full bg-fuchsia-500 blur-3xl" />
              </div>

              <div className="relative">
                <div className="text-xs opacity-80">TurbotaAI</div>
                <div className="mt-2 text-lg font-semibold">TurbotaAI Monthly</div>
                <div className="mt-3 text-sm opacity-80">Натисніть, щоб перейти до оплати</div>
              </div>
            </button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Ваш профіль</CardTitle>
              <CardDescription>Перевірити доступ і історію</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Статус</div>
                <div className="text-right">{summaryLoading ? "…" : isLoggedIn ? "Виконано" : "Не виконано"}</div>

                <div className="text-muted-foreground">Доступ</div>
                <div className="text-right">{accessLabel}</div>

                <div className="text-muted-foreground">Залишилось запитань</div>
                <div className="text-right">{summaryLoading ? "…" : trialLeft}</div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="w-full" onClick={() => window.location.assign("/profile")}>
                  Відкрити профіль
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => (isLoggedIn ? doLogout() : window.location.assign("/login?next=/pricing"))}
                >
                  {isLoggedIn ? "Вийти" : "Увійти"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Промокод</CardTitle>
              <CardDescription>12 місяців безкоштовного доступу за промокодом</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <Input
                  value={promo}
                  onChange={(e) => {
                    setPromo(e.target.value);
                    if (promoState !== "idle") setPromoState("idle");
                    if (promoMsg) setPromoMsg("");
                  }}
                  placeholder="Промокод"
                />
                <Button variant="outline" disabled={!promo.trim() || promoState === "loading"} onClick={redeemPromo}>
                  {promoState === "loading" ? "…" : "Активувати"}
                </Button>
              </div>

              {promoMsg ? (
                <div className={`text-sm ${promoState === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {promoMsg}
                </div>
              ) : null}

              {!isLoggedIn ? (
                <div className="text-xs text-muted-foreground">
                  Щоб активувати промокод, потрібно увійти або зареєструватись.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Керувати доступом</CardTitle>
              <CardDescription>Підписка та промо у профілі</CardDescription>
            </CardHeader>

            <CardContent>
              <Button className="w-full" onClick={() => window.location.assign("/profile")}>
                Відкрити налаштування
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 text-xs text-muted-foreground"></div>
    </div>
  );
}
