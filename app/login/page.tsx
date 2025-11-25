"use client"

import LoginForm from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/5 via-white to-primary/5">
      <div className="pt-20 pb-12 px-4">
        <LoginForm />
      </div>
    </div>
  )
}
