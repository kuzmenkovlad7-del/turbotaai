// components/contact-method-card.tsx
"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full w-full flex-col rounded-3xl p-[1px] text-left",
        "transition-transform duration-300 ease-out hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50",
        "shadow-[0_22px_55px_rgba(15,23,42,0.55)]",
      )}
    >
      {/* светящийся градиентный бордер */}
      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_0_0,rgba(129,230,217,0.35),transparent_60%),radial-gradient(circle_at_100%_0,rgba(129,140,248,0.6),transparent_60%),radial-gradient(circle_at_50%_100%,rgba(244,114,182,0.4),transparent_60%)] opacity-60 transition-opacity duration-300 group-hover:opacity-100" />

      {/* сама карточка */}
      <div className="relative flex h-full flex-col rounded-[1.45rem] bg-slate-950/96 px-6 py-6 text-slate-50">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 ring-1 ring-slate-700/80">
            <Icon className="h-5 w-5 text-sky-300" />
          </div>
          <h3 className="text-base font-semibold md:text-lg">{title}</h3>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-300">
          {description}
        </p>

        {/* псевдо-кнопка внутри карточки */}
        <div className="mt-auto">
          <span className="inline-flex w-full items-center justify-center rounded-full bg-slate-800/90 px-4 py-2 text-sm font-medium text-slate-100 transition group-hover:bg-sky-500 group-hover:text-white">
            {buttonText}
          </span>
        </div>
      </div>
    </button>
  )
}

export default ContactMethodCard
