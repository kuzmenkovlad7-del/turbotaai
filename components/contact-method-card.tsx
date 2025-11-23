"use client"

import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ContactMethodCardProps {
  icon: LucideIcon
  title: string
  description: string
  buttonText: string
  onClick: () => void
}

export function ContactMethodCard({
  icon: Icon,
  title,
  description,
  buttonText,
  onClick,
}: ContactMethodCardProps) {
  return (
    <div className="group relative h-full">
      {/* Glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#6366F1]/10 via-[#EC4899]/5 to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex h-full flex-col rounded-2xl border border-slate-100 bg-white/95 p-6 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899]">
          <Icon className="h-7 w-7 text-white" />
        </div>

        <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mb-6 flex-1 text-sm text-muted-foreground">{description}</p>

        <Button
          onClick={onClick}
          className="w-full rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  )
}
