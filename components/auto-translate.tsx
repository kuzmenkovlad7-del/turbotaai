// @ts-nocheck
"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { translateElement } from "@/lib/i18n/translation-utils"

interface AutoTranslateProps {
  children: React.ReactNode
  className?: string
  enabled?: boolean
  excludeSelectors?: string[]
}

export function AutoTranslate({ children, className = "", enabled = true, excludeSelectors = [] }: AutoTranslateProps) {
  const { currentLanguage } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const lastLanguageRef = useRef<string>("")

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    // Only translate if language actually changed
    if (lastLanguageRef.current === currentLanguage.code) return

    const translateContent = async () => {
      if (!containerRef.current) return

      const combinedExcludes = [
        "[data-notranslate]",
        ".notranslate",
        ".no-translate",
        ...excludeSelectors,
      ]

      try {
        // Skip if this is the first load and already in target language
        if (!lastLanguageRef.current && currentLanguage.code === "en") {
          lastLanguageRef.current = currentLanguage.code
          return
        }

        console.log(`🌐 Auto-translating content to ${currentLanguage.name}`)

        // Get all elements that should be translated
        const elementsToTranslate = containerRef.current.querySelectorAll("*")

        for (const element of Array.from(elementsToTranslate)) {
          // Skip excluded elements
          if (combinedExcludes.some((selector) => element.matches(selector))) {
            continue
          }

          // Skip elements that are likely to contain code or technical content
          if (
            element.tagName.toLowerCase() === "code" ||
            element.tagName.toLowerCase() === "pre" ||
            element.classList.contains("no-translate") ||
            element.classList.contains("notranslate") ||
            element.getAttribute("data-notranslate") !== null
          ) {
            continue
          }

          await translateElement(element as HTMLElement, currentLanguage.code)
        }

        lastLanguageRef.current = currentLanguage.code
        console.log(`✅ Auto-translation to ${currentLanguage.name} completed`)
      } catch (error) {
        console.error("Auto-translation error:", error)
      }
    }

    // Debounce translation to avoid excessive API calls
    const timeoutId = setTimeout(translateContent, 500)

    return () => clearTimeout(timeoutId)
  }, [currentLanguage.code, enabled, excludeSelectors])

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}

// Default export for compatibility
export default AutoTranslate
