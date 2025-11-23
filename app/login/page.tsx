import Header from "@/components/header"
import LoginForm from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5">
      <Header />
      <div className="pt-20 pb-12 px-4">
        <LoginForm />
      </div>
    </div>
  )
}
