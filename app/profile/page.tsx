"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type Summary = {
  ok: boolean
  principal: string
  trialLeft: number
  paidUntil: string | null
  promoUntil: string | null
  hasAccess: boolean
}

export default function ProfilePage() {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/account/summary")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    fetch("/api/history/list")
      .then((r) => r.json())
      .then((d) => setHistory(d?.conversations || []))
      .catch(() => {})
  }, [user])

  if (isLoading) {
    return <div className="min-h-[calc(100vh-96px)] flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Profile</h1>
        <div className="flex items-center gap-3">
          <Link href="/pricing">
            <Button variant="outline">Pricing</Button>
          </Link>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut()
              router.push("/")
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Login status and access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-700">
              <div><span className="text-slate-500">Email:</span> {user?.email || "Guest"}</div>
              <div><span className="text-slate-500">Access:</span> {summary?.hasAccess ? "Active" : "Limited"}</div>
              <div><span className="text-slate-500">Trial left:</span> {summary?.trialLeft ?? "—"}</div>
              <div><span className="text-slate-500">Paid until:</span> {summary?.paidUntil ?? "—"}</div>
              <div><span className="text-slate-500">Promo until:</span> {summary?.promoUntil ?? "—"}</div>
            </div>

            <Link href="/pricing">
              <Button className="w-full">Manage subscription</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Saved sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!user && (
              <p className="text-sm text-slate-600">
                Login to see history.
              </p>
            )}

            {user && history.length === 0 && (
              <p className="text-sm text-slate-600">No sessions yet.</p>
            )}

            {user && history.length > 0 && (
              <div className="space-y-2">
                {history.slice(0, 10).map((c) => (
                  <Link key={c.id} href={`/profile?conv=${c.id}`} className="block">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{c.mode}</div>
                      <div className="text-xs text-slate-500">Updated: {c.updated_at}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
