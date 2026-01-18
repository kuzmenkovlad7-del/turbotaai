"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SubStatus = {
  ok: boolean;
  userId?: string;
  hasAccess?: boolean;
  accessUntil?: string | null;
  paidUntil?: string | null;
  promoUntil?: string | null;
  autoRenew?: boolean;
  subscriptionStatus?: string;
  error?: string;
};

function fmtDate(v?: string | null) {
  if (!v) return "Not active";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Not active";
  return d.toLocaleString();
}

export default function SubscriptionClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubStatus | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");

  const statusLabel = useMemo(() => {
    if (!data?.ok) return "Unknown";
    if (data.subscriptionStatus === "canceled") return "Canceled";
    return data.hasAccess ? "Active" : "Inactive";
  }, [data]);

  async function refresh() {
    setLoading(true);
    setMsg(null);

    try {
      const r = await fetch("/api/billing/subscription/status", { credentials: "include" });

      if (r.status === 401) {
        router.push("/login");
        return;
      }

      const j = (await r.json().catch(() => ({}))) as SubStatus;
      setData(j);
    } catch (e: any) {
      setData({ ok: false, error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function payMonthly() {
    setBusy("pay");
    setMsg(null);
    try {
      const r = await fetch("/api/billing/wayforpay/create-invoice", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "monthly" }),
      });

      if (r.status === 401) {
        router.push("/login");
        return;
      }

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok || !j?.invoiceUrl) {
        setMsg(j?.error || "Failed to create invoice");
        return;
      }

      window.location.href = j.invoiceUrl;
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  async function cancelAutoRenew() {
    setBusy("cancel");
    setMsg(null);
    try {
      const r = await fetch("/api/billing/subscription/cancel", { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) {
        setMsg(j?.error || "Cancel failed");
        return;
      }
      await refresh();
      setMsg("Auto-renew is off. Current access stays until Paid until.");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  async function resumeAutoRenew() {
    setBusy("resume");
    setMsg(null);
    try {
      const r = await fetch("/api/billing/subscription/resume", { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) {
        setMsg(j?.error || "Resume failed");
        return;
      }
      await refresh();
      setMsg("Auto-renew is on.");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) {
      setMsg("Enter promo code");
      return;
    }

    setBusy("promo");
    setMsg(null);

    try {
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) {
        setMsg(j?.error || "Promo failed");
        return;
      }

      setPromoCode("");
      await refresh();
      setMsg("Promo activated.");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">Subscription</h1>
          <p className="mt-1 text-sm text-slate-500">Manage billing, access and auto-renew</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-full border border-slate-200" onClick={() => router.push("/profile")}>
            Back to profile
          </Button>
          <Button variant="outline" className="rounded-full border border-slate-200" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Status</CardTitle>
            <CardDescription>Your access and renewal settings</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : !data?.ok ? (
              <>
                <div className="font-medium text-slate-900">Failed to load</div>
                <div className="text-slate-500">{data?.error || "Unknown error"}</div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-slate-500">Status:</span>{" "}
                  <span className="font-medium">{statusLabel}</span>
                </div>

                <div>
                  <span className="text-slate-500">Auto-renew:</span>{" "}
                  <span className="font-medium">{data.autoRenew ? "On" : "Off"}</span>
                </div>

                <div className="pt-2">
                  <span className="text-slate-500">Access until:</span>{" "}
                  <span className="font-medium">{fmtDate(data.accessUntil ?? null)}</span>
                </div>

                <div>
                  <span className="text-slate-500">Paid until:</span>{" "}
                  <span className="font-medium">{fmtDate(data.paidUntil ?? null)}</span>
                </div>

                <div>
                  <span className="text-slate-500">Promo until:</span>{" "}
                  <span className="font-medium">{fmtDate(data.promoUntil ?? null)}</span>
                </div>

                <div className="pt-4 space-y-3">
                  <Button
                    className="w-full rounded-full"
                    disabled={busy !== null}
                    onClick={payMonthly}
                  >
                    {busy === "pay" ? "Redirecting..." : (data.hasAccess ? "Extend subscription" : "Start subscription")}
                  </Button>

                  {data.autoRenew ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-full border border-slate-200"
                      disabled={busy !== null}
                      onClick={cancelAutoRenew}
                    >
                      {busy === "cancel" ? "Canceling..." : "Cancel auto-renew"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-full border border-slate-200"
                      disabled={busy !== null}
                      onClick={resumeAutoRenew}
                    >
                      {busy === "resume" ? "Resuming..." : "Resume auto-renew"}
                    </Button>
                  )}
                </div>

                {msg ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {msg}
                  </div>
                ) : null}

                <div className="pt-3 text-xs text-slate-500">
                  Cancel auto-renew does not remove access immediately. It only stops future renewals inside your account.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Promo</CardTitle>
            <CardDescription>Activate access using promo code</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              className="rounded-xl"
              disabled={busy !== null}
            />

            <Button
              variant="outline"
              className="w-full rounded-full border border-slate-200"
              onClick={applyPromo}
              disabled={busy !== null}
            >
              {busy === "promo" ? "Applying..." : "Apply promo"}
            </Button>

            <div className="text-xs text-slate-500">
              Promo updates access without payment. It will appear as Promo until in your account.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
