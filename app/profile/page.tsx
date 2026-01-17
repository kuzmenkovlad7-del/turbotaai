"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  ok: boolean;
  isLoggedIn: boolean;
  email: string | null;
  access: "Paid" | "Promo" | "Limited";
  trialLeft: number;
  paidUntil: string | null;
  promoUntil: string | null;
};

type HistoryItem = {
  id: string;
  title: string | null;
  updated_at: string | null;
  mode?: string | null;
};

function fmtDate(v: string | null) {
  if (!v) return "Not active";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Not active";
  return d.toLocaleString();
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Summary | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    try {
      const r = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" });
      const data = (await r.json().catch(() => ({}))) as Summary;
      setS(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const r = await fetch("/api/history/list", { cache: "no-store", credentials: "include" });
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok || d?.ok === false) {
        setHistoryError(d?.error || "Failed to load history");
        setHistory([]);
        return;
      }
      setHistory(Array.isArray(d?.conversations) ? d.conversations : []);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/clear", { method: "POST", credentials: "include" }).catch(() => null);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    if (s?.isLoggedIn) loadHistory();
  }, [s?.isLoggedIn]);

  const isLoggedIn = !!s?.isLoggedIn;
  const email = s?.email || "Guest";
  const access = (s as any)?.access || "Limited";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-semibold">Profile</h1>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-full border border-slate-200"
            onClick={() => router.push("/pricing")}
          >
            Pricing
          </Button>

          {isLoggedIn ? (
            <Button variant="outline" className="rounded-full border border-slate-200" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Button variant="outline" className="rounded-full border border-slate-200" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Account</CardTitle>
            <CardDescription>Login status and access</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : (
              <>
                <div>
                  <span className="text-slate-500">Email:</span>{" "}
                  <span className="font-medium">{email}</span>
                </div>

                <div>
                  <span className="text-slate-500">Access:</span>{" "}
                  <span className="font-medium">{access}</span>
                </div>

                <div>
                  <span className="text-slate-500">Trial left:</span>{" "}
                  <span className="font-medium">{typeof s?.trialLeft === "number" ? s.trialLeft : 0}</span>
                </div>

                <div>
                  <span className="text-slate-500">Paid until:</span>{" "}
                  <span className="font-medium">{fmtDate(s?.paidUntil ?? null)}</span>
                </div>

                <div>
                  <span className="text-slate-500">Promo until:</span>{" "}
                  <span className="font-medium">{fmtDate(s?.promoUntil ?? null)}</span>
                </div>

                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full rounded-full border border-slate-200"
                    onClick={() => router.push("/pricing")}
                  >
                    Manage subscription
                  </Button>
                </div>

                {!isLoggedIn ? (
                  <div className="pt-2 text-xs text-slate-500">
                    Log in to unlock saved sessions and promo.
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">History</CardTitle>
            <CardDescription>Saved sessions</CardDescription>
          </CardHeader>

          <CardContent className="text-sm text-slate-700">
            {!isLoggedIn ? (
              "Login to see history."
            ) : historyLoading ? (
              "Loading..."
            ) : historyError ? (
              <div className="text-red-600">{historyError}</div>
            ) : history.length === 0 ? (
              "History will appear here after first session."
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <Link
                    key={h.id}
                    href={`/history/${h.id}`}
                    className="block rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{h.title || "Session"}</div>
                    <div className="text-xs text-slate-500">
                      {h.updated_at ? new Date(h.updated_at).toLocaleString() : ""}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
