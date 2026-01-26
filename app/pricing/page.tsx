"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Summary = {
  signedIn: boolean;
  accessLabel: string;
  questionsLeft: number;
};

function normalizeSummary(j: any): Summary {
  const signedIn = Boolean(j?.signedIn ?? j?.signed_in ?? j?.isSignedIn ?? j?.user?.id);

  const rawAccess = String(
    j?.access ??
      j?.tier ??
      j?.plan ??
      j?.subscription?.tier ??
      (j?.subscription?.active ? "paid" : "free") ??
      (j?.isPaid ? "paid" : "free") ??
      "free"
  ).toLowerCase();

  const accessLabel =
    rawAccess.includes("paid") || rawAccess.includes("premium") || rawAccess.includes("pro")
      ? "Платно"
      : "Безкоштовно";

  const q =
    j?.questionsLeft ??
    j?.questions_left ??
    j?.questionsRemaining ??
    j?.remainingQuestions ??
    j?.remaining ??
    j?.left ??
    0;

  const questionsLeft = Number.isFinite(Number(q)) ? Number(q) : 0;

  return { signedIn, accessLabel, questionsLeft };
}

export default function PricingPage() {
  const PRICE_UAH = useMemo(() => {
    const v = Number(process.env.NEXT_PUBLIC_PRICE_UAH ?? 499);
    return Number.isFinite(v) && v > 0 ? v : 499;
  }, []);

  const CURRENCY = useMemo(() => {
    const v = String(process.env.NEXT_PUBLIC_CURRENCY ?? "UAH").trim();
    return v || "UAH";
  }, []);

  const [promo, setPromo] = useState("");
  const [summary, setSummary] = useState<Summary>({
    signedIn: false,
    accessLabel: "Безкоштовно",
    questionsLeft: 0,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetch("/api/account/summary", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        setSummary(normalizeSummary(j));
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-80px)] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold tracking-tight">Тарифи</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Безлімітний доступ до чату, голосу та відео. Пробний режим має 5 запитань.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* LEFT: PLAN */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-2xl">Щомісяця</CardTitle>
              <CardDescription>Безлімітний доступ до чату, голосу і відео</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="flex items-baseline gap-3">
                <div className="text-6xl font-extrabold tracking-tight leading-none">
                  {PRICE_UAH}
                </div>
                <div className="text-sm text-muted-foreground uppercase">{CURRENCY}</div>
              </div>

              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>• Безлімітна кількість запитів</li>
                <li>• Чат, голос і відео</li>
                <li>• Історія зберігається у профілі</li>
              </ul>

              <div className="mt-6 rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
                <div className="text-sm opacity-80">TurbotaAI</div>
                <div className="mt-10 text-lg font-semibold opacity-90">TurbotaAI Monthly</div>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: PROFILE + PROMO + MANAGE */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Ваш профіль</CardTitle>
                <CardDescription>Перевірити доступ і історію</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div className="text-muted-foreground">Статус</div>
                  <div className="text-right">{summary.signedIn ? "Вхід виконано" : "Не виконано"}</div>

                  <div className="text-muted-foreground">Доступ</div>
                  <div className="text-right">{summary.accessLabel}</div>

                  <div className="text-muted-foreground">Залишилось запитань</div>
                  <div className="text-right">{summary.questionsLeft}</div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.assign("/profile")}
                  >
                    Відкрити профіль
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.assign("/api/auth/logout")}
                  >
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
      </div>
    </div>
  );
}
