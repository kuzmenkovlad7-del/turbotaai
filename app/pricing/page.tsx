"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Summary = any;

export default function PricingPage() {
  const [promo, setPromo] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  const monthlyPrice = useMemo(() => {
    const v =
      Number((process.env.NEXT_PUBLIC_TA_MONTHLY_PRICE_UAH || "").toString()) ||
      Number((process.env.NEXT_PUBLIC_MONTHLY_PRICE_UAH || "").toString()) ||
      499;
    return v;
  }, []);

  const monthlyPriceLabel = useMemo(() => {
    return new Intl.NumberFormat("uk-UA").format(monthlyPrice);
  }, [monthlyPrice]);

  const questionsLeft = useMemo(() => {
    const n =
      summary?.questionsLeft ??
      summary?.questions_left ??
      summary?.remainingQuestions ??
      summary?.remaining_questions ??
      summary?.limits?.questionsLeft ??
      null;

    return typeof n === "number" && Number.isFinite(n) ? n : 5;
  }, [summary]);

  const isPaid = useMemo(() => {
    const v =
      summary?.isPaid ??
      summary?.paid ??
      summary?.subscription?.active ??
      summary?.subscriptionActive ??
      summary?.plan === "paid";
    return Boolean(v);
  }, [summary]);

  const loginStatus = useMemo(() => {
    const v =
      summary?.isLoggedIn ??
      summary?.loggedIn ??
      summary?.user?.id ??
      summary?.user_id ??
      summary?.email ??
      null;
    return Boolean(v);
  }, [summary]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/account/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (mounted) setSummary(j);
      })
      .catch(() => {
        if (mounted) setSummary(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Тарифи</h1>
        <p className="mt-2 text-muted-foreground">
          Безлімітний доступ до чату, голосу і відео. Пробний режим має 5 запитань.
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
                <div className="mt-3 text-sm opacity-80">
                  Натисніть, щоб перейти до оплати
                </div>
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
                <div className="text-right">{loginStatus ? "Виконано" : "Не виконано"}</div>

                <div className="text-muted-foreground">Доступ</div>
                <div className="text-right">{isPaid ? "Підписка активна" : "Безкоштовно"}</div>

                <div className="text-muted-foreground">Залишилось запитань</div>
                <div className="text-right">{questionsLeft}</div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="w-full" onClick={() => window.location.assign("/profile")}>
                  Відкрити профіль
                </Button>

                <Button variant="outline" className="w-full" onClick={() => window.location.assign("/api/auth/logout")}>
                  Вийти
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Промокод</CardTitle>
              <CardDescription>12 місяців безкоштовного доступу за промокодом</CardDescription>
            </CardHeader>

            <CardContent className="flex gap-3">
              <Input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Промокод" />
              <Button variant="outline" disabled={!promo.trim()}>
                Активувати промо
              </Button>
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

      <div className="mt-6 text-xs text-muted-foreground">
        Для перевірки підпису WayForPay: <span className="font-mono">/api/billing/wayforpay/purchase?planId=monthly&debug=1</span>
      </div>
    </div>
  );
}
