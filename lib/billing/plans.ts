export type Plan = {
  id: string
  title: string
  description: string
  months: number
  amount: number
  currency: "UAH" | "USD" | "EUR"
}

export const PLANS: Plan[] = [
  {
    id: "monthly",
    title: "Monthly",
    description: "Unlimited chat, voice and video access",
    months: 1,
    amount: 499,
    currency: "UAH",
  },
  {
    id: "yearly",
    title: "Yearly",
    description: "Best value for long-term support",
    months: 12,
    amount: 3999,
    currency: "UAH",
  },
]

export function getPlan(planId: string): Plan | null {
  return PLANS.find((p) => p.id === planId) ?? null
}
