"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Msg = {
  id: string;
  role: string;
  content: string;
  created_at?: string;
};

export default function HistoryItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String((params as any)?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [title, setTitle] = useState<string>("Session");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setErrorText(null);

      try {
        const r = await fetch(`/api/history/${id}`, { cache: "no-store", credentials: "include" });
        const data = await r.json().catch(() => ({} as any));

        if (!alive) return;

        if (!r.ok || data?.ok === false) {
          setErrorText(data?.error || "Failed to load session");
          setMessages([]);
          return;
        }

        setTitle(String(data?.conversation?.title || "Session"));
        setMessages(Array.isArray(data?.messages) ? data.messages : []);
      } catch (e: any) {
        if (!alive) return;
        setErrorText("Failed to load session");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    if (id) run();

    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">Messages</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <Card className="rounded-2xl border border-slate-200">
        <CardHeader>
          <CardTitle className="text-2xl">Messages</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-sm text-slate-700">
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : errorText ? (
            <div className="text-red-600">{errorText}</div>
          ) : messages.length === 0 ? (
            <div className="text-slate-500">No messages yet</div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                    {m.role}
                  </div>
                  <div className="whitespace-pre-wrap text-slate-900">{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
