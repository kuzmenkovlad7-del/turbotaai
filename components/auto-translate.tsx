// @ts-nocheck
"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { translateElement } from "@/lib/i18n/translation-utils"

interface AutoTranslateProps {
  children: React.ReactNode
  className?: string
  enabled?: boolean
  excludeSelectors?: string[]
}

export function AutoTranslate({
  children,
  className = "",
  enabled = true,
  excludeSelectors = [],
}: AutoTranslateProps) {
  const { currentLanguage } = useLanguage()
  const pathname = usePathname()

  const containerRef = useRef<HTMLDivElement>(null)
  const lastLanguageRef = useRef<string>("")
  const lastPathRef = useRef<string>("")

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    // ✅ ВАЖНО: если менялась страница, переводим заново даже при том же языке
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname
      lastLanguageRef.current = ""
    }

    // Only translate if language actually changed (или страница новая -> мы сбросили)
    if (lastLanguageRef.current === currentLanguage.code) return

    const translateContent = async () => {
      if (!containerRef.current) return

      try {
        // Get all elements that should be translated
        const elementsToTranslate = containerRef.current.querySelectorAll("*")

        for (const element of Array.from(elementsToTranslate)) {
          // ✅ не переводим элементы внутри блоков, которые явно запрещены
          const el = element as HTMLElement
          if (el.closest('[data-no-translate="true"]') || el.closest(".no-translate")) {
            continue
          }

          // Skip excluded elements
          if (excludeSelectors.some((selector) => element.matches(selector))) {
            continue
          }

          // Skip elements that are likely to contain code or technical content
          if (
            element.tagName.toLowerCase() === "code" ||
            element.tagName.toLowerCase() === "pre" ||
            element.classList.contains("no-translate")
          ) {
            continue
          }

          await translateElement(element as HTMLElement, currentLanguage.code)
        }

        lastLanguageRef.current = currentLanguage.code
      } catch (error) {
        console.error("Auto-translation error:", error)
      }
    }

    // ✅ быстрее, чтобы не было ощущения “не сразу”
    const timeoutId = setTimeout(translateContent, 80)

    return () => clearTimeout(timeoutId)
  }, [currentLanguage.code, currentLanguage.name, pathname, enabled, excludeSelectors])

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}

// Default export for compatibility
export default AutoTranslate
