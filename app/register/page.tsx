"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand/BrandMark";

export default function RegisterPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  useEffect(() => {
    const q = (sp.get("email") || "").trim();
    if (q) setEmail(q);
  }, [sp]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorText(null);
    setSuccessText(null);

    const e1 = email.trim();
    const n1 = fullName.trim();

    if (!e1 || !password) {
      setErrorText("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      // 1) Register
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: e1,
          password,
          fullName: n1 || null,
          full_name: n1 || null,
          name: n1 || null,
        }),
      });

      const data = await r.json().catch(() => ({} as any));
      if (!r.ok || data?.ok === false) {
        setErrorText(data?.error || "Registration failed");
        return;
      }

      // 2) Auto login
      const r2 = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: e1, password }),
      });

      const data2 = await r2.json().catch(() => ({} as any));
      if (!r2.ok || data2?.ok === false) {
        setSuccessText("Account created. Please sign in.");
        router.replace(`/login?email=${encodeURIComponent(e1)}`);
        return;
      }

      setSuccessText("Account created");
      router.replace("/profile");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function goLogin() {
    const e1 = email.trim();
    router.push(e1 ? `/login?email=${encodeURIComponent(e1)}` : "/login");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex items-center justify-center">
            <BrandMark size={36} />
          </div>
          <CardTitle className="text-3xl">Create account</CardTitle>
          <p className="text-sm text-muted-foreground">Sign up to save sessions and manage access</p>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name (optional)</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </div>

            {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
            {successText ? <p className="text-sm text-green-600">{successText}</p> : null}

            <Button type="submit" variant="outline" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Sign Up"}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <span>Already have an account?</span>
              <Button type="button" variant="outline" onClick={goLogin}>
                Sign In
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
