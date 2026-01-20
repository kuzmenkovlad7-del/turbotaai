"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RainbowButton } from "@/components/ui/rainbow-button"
import TurbotaHoloCard from "@/components/turbota-holo-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AnyObj = Record<string, any>;

export default function PricingPage() {

const router = useRouter();

  const [summary, setSummary] = useState<AnyObj | null>(null);

  const [trialText, setTrialText] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [payLoading, setPayLoading] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  const trialLeft = useMemo(() => {
    const v = summary?.trialLeft ?? summary?.trial_left ?? summary?.trial ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [summary]);

  const isLoggedIn = Boolean(summary?.isLoggedIn ?? summary?.loggedIn ?? summary?.user);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoadingSummary(true);
      try {
        const r = await fetch("/api/account/summary", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (alive) setSummary(d);
      } catch {
        if (alive) setSummary(null);
      } finally {
        if (alive) setLoadingSummary(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubscribe() {
    setPayMsg(null);
    setPayLoading(true);

    try {
      const r = await fetch("/api/billing/wayforpay/create-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 499, currency: "UAH", productName: "TurbotaAI Monthly" }) });

      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.invoiceUrl) {
        const missing = Array.isArray(d?.missing) ? ` Missing: ${d.missing.join(", ")}` : "";
        throw new Error((d?.error || "Payment init failed") + missing);
      }

      window.open(d.invoiceUrl, "_blank", "noopener,noreferrer");
      setPayMsg("Invoice created. Complete payment in the opened tab.");
    } catch (e: any) {
      setPayMsg(e?.message || "Payment init failed");
    } finally {
      setPayLoading(false);
    }
  }

  async function handleActivatePromo() {
    setPromoMsg(null);
    setPromoLoading(true);

    try {
      // ✅ у Вас в build есть /api/billing/promo/redeem
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }) });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Promo activation failed");

      setPromoMsg("Promo activated");

      // refresh summary
      const s = await fetch("/api/account/summary", { cache: "no-store" }).then((x) => x.json());
      setSummary(s);
    } catch (e: any) {
      setPromoMsg(e?.message || "Promo activation failed");
    } finally {
      setPromoLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-semibold">Тарифы</h1>
      <p className="mt-2 text-muted-foreground">
        Unlimited access to chat, voice and video sessions. Trial includes 5 questions.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Monthly</CardTitle>
            <CardDescription>Unlimited chat, voice and video access</CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            <div className="flex items-end gap-3">
              <div className="text-6xl font-bold leading-none">499</div>
              <div className="pb-1 text-muted-foreground">UAH</div>
            </div>

            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Unlimited questions</li>
              <li>Chat, voice and video</li>
              <li>History saved in your profile</li>
            </ul>

            {/* ✅ Отступы сверху/снизу чтобы анимация не цепляла текст */}
            <div className="mt-6 py-4">
              {/* ✅ Карта кликабельная: клик = подписка */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleSubscribe}
                onKeyDown={(e) => (e.key === "Enter" ? handleSubscribe() : null)}
                className="cursor-pointer"
                title="Subscribe"
              >
                <TurbotaHoloCard title="TurbotaAI" subtitle="TurbotaAI Monthly" height={260} />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <RainbowButton id="turbota-subscribe" onClick={handleSubscribe} disabled={payLoading} className="border border-slate-200">
                {payLoading ? "Opening..." : "Subscribe"}
              </RainbowButton>

              {payMsg ? (
                <p className={`text-sm ${payMsg.toLowerCase().includes("failed") ? "text-red-600" : "text-muted-foreground"}`}>
                  {payMsg}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can pay without login. For promo activation and history we recommend logging in.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Your profile</CardTitle>
              <CardDescription>Check trial balance and history</CardDescription>
            </CardHeader>

            <CardContent className="pb-8">
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="text-slate-900">
                    {loadingSummary ? "Loading..." : isLoggedIn ? "Logged in" : "Guest"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{trialText ? "Access" : "Trial left"}</span>
                  <span className="text-slate-900">{loadingSummary ? "…" : (typeof trialText === "string" ? trialText : (Number.isFinite(Number(trialLeft)) ? Number(trialLeft) : 0))}</span>
                </div>

                {summary?.accessUntil || summary?.access_until ? (
                  <div className="flex items-center justify-between">
                    <span>Access until</span>
                    <span className="text-slate-900">{String(summary?.accessUntil ?? summary?.access_until)}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="border border-slate-200" onClick={() => router.push("/profile")}>
                  Open profile
                </Button>

                {isLoggedIn ? (
                  <Button
                    variant="outline"
                    className="border border-slate-200"
                    onClick={async () => {
                      await fetch("/api/auth/clear", { method: "POST" }).catch(() => {});
                      router.refresh();
                      router.push("/");
                    }}
                  >
                    Log out
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="border border-slate-200"
                    onClick={() => router.push("/login")}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Promo code</CardTitle>
              <CardDescription>12 months free access by promo code</CardDescription>
            </CardHeader>

            <CardContent className="pb-8">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo code"
                  autoCapitalize="characters"
                />

                <Button
                  onClick={handleActivatePromo}
                  disabled={promoLoading || !promoCode.trim() || !isLoggedIn}
                  className="border border-slate-200"
                >
                  {promoLoading ? "Activating..." : "Activate promo"}
                </Button>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Promo activation requires login.
              </div>

              {promoMsg ? (
                <p className={`mt-2 text-sm ${promoMsg.toLowerCase().includes("failed") ? "text-red-600" : "text-muted-foreground"}`}>
                  {promoMsg}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
