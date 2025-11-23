"use client"

import type React from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContactMethodCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: string
  buttonText: string
  onClick?: () => void
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
        "group relative flex h-full flex-col text-left",
        // внешний градиентный бордер
        "rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-[1px]",
        "shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300",
        "hover:-translate-y-1.5 hover:shadow-[0_24px_80px_rgba(15,23,42,0.16)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50",
      )}
    >
      <div className="flex h-full flex-col rounded-[1.4rem] bg-white/95 p-6">
        {/* Иконка */}
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm transition-colors duration-300 group-hover:bg-indigo-600 group-hover:text-white">
          <Icon className="h-5 w-5" />
        </div>

        {/* Текст */}
        <div className="mb-4 space-y-2">
          <h3 className="text-base font-semibold text-slate-900">
            {title}
          </h3>
          <p className="text-xs text-slate-600 sm:text-sm">
            {description}
          </p>
        </div>

        {/* CTA-кнопка внутри карточки */}
        <div className="mt-auto pt-2">
          <div className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-md shadow-indigo-500/30 transition-all duration-300 group-hover:bg-slate-900/95">
            {buttonText}
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </button>
  )
}
