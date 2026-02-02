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

/* ── Region-aware pricing (server-authoritative) ──────────── */

export type RegionPrice = { amount: number; currency: "UAH" | "USD" }

const PRICE_UAH = Number(process.env.PRICE_UAH || process.env.NEXT_PUBLIC_PRICE_UAH || "499")
const PRICE_USD = Number(process.env.PRICE_USD || process.env.NEXT_PUBLIC_PRICE_USD || "12")

/**
 * Returns the correct amount + currency for a given planId and region.
 * region = "UA" → UAH pricing, anything else → USD pricing.
 */
export function getRegionPrice(planId: string, region: string): RegionPrice {
  const plan = getPlan(planId)
  if (region === "UA") {
    return { amount: plan ? plan.amount : PRICE_UAH, currency: "UAH" }
  }
  // INTL — use USD equivalent
  if (planId === "yearly") {
    const yearlyUsd = Number(process.env.PRICE_USD_YEARLY || Math.round(PRICE_USD * 10))
    return { amount: yearlyUsd, currency: "USD" }
  }
  return { amount: PRICE_USD, currency: "USD" }
}
