"use client"

import { useState, useEffect } from "react"
import { useLanguage } from "./language-context"
import { extractTranslatableStrings } from "./translation-utils"

export function TranslationDebug() {
  const { missingTranslations, translations, currentLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    translated: 0,
    missing: 0,
    coverage: 0,
  })

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      // Get all translatable strings from the document
      const allStrings = extractTranslatableStrings()
      const translatedCount = Object.keys(translations).length
      const missingCount = missingTranslations.size
      const totalCount = allStrings.length
      const coverage = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0

      setStats({
        total: totalCount,
        translated: translatedCount,
        missing: missingCount,
        coverage,
      })
    }
  }, [translations, missingTranslations])

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-yellow-500 text-black px-4 py-2 rounded-md shadow-lg flex items-center gap-2"
      >
        <span>{currentLanguage.flag}</span>
        <span>
          Translation Coverage: {stats.coverage}% ({stats.translated}/{stats.total})
        </span>
      </button>

      {isOpen && (
        <div className="bg-white border border-gray-300 rounded-md shadow-xl p-4 mt-2 max-h-96 overflow-auto w-96">
          <h3 className="font-bold mb-2">Translation Stats for {currentLanguage.label}</h3>
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span>Total strings:</span>
              <span>{stats.total}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Translated:</span>
              <span>{stats.translated}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Missing:</span>
              <span>{stats.missing}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Coverage:</span>
              <span>{stats.coverage}%</span>
            </div>
          </div>

          {missingTranslations.size > 0 && (
            <>
              <h4 className="font-semibold mt-4 mb-2">Missing Translations</h4>
              <ul className="text-sm max-h-40 overflow-auto">
                {Array.from(missingTranslations).map((key) => (
                  <li key={key} className="mb-1 pb-1 border-b border-gray-100">
                    {key}
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    const keysText = Array.from(missingTranslations)
                      .map((key) => `"${key}": "",`)
                      .join("\n")
                    navigator.clipboard.writeText(keysText)
                    alert("Missing translations copied to clipboard!")
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Copy as JSON
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
