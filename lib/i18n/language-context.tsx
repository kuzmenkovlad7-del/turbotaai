"use client"

import { useRef } from "react"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type Language, languages } from "./languages"
import { getTranslations } from "./translations"
import {
  translateDocument,
  translateElement,
  translateWithFallback,
  translateWithParams,
  forceCompleteRetranslation,
} from "./translation-utils"

interface LanguageContextType {
  currentLanguage: Language
  setLanguage: (language: Language) => void
  t: (key: string, params?: Record<string, any>) => string
  isLoading: boolean
  supportedLanguages: Language[]
  translateWithFallback: (key: string, fallbackLanguage?: string) => string
  getTranslationCoverage: () => number
  isReady: boolean
  changeLanguage: (code: string) => void
  forceRetranslate: () => void
}

const defaultLanguage = languages[0] // Default to English for better compatibility

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

interface LanguageProviderProps {
  children: ReactNode
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  // Initialize with default language and translations immediately
  const [currentLanguage, setCurrentLanguage] = useState<Language>(defaultLanguage)
  const [translations, setTranslations] = useState<Record<string, string>>(getTranslations("en"))
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isRTL, setIsRTL] = useState(false)
  const missingTranslationsRef = useRef<Set<string>>(new Set())
  const observerRef = useRef<MutationObserver | null>(null)
  const isInitialRender = useRef(true)
  const translationCacheRef = useRef<Map<string, Record<string, string>>>(new Map())
  const previousLanguageRef = useRef<string>("")

  // Function to detect browser language with improved logic
  const detectBrowserLanguage = () => {
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("preferredLanguage")
      if (savedLanguage) {
        // Check if the saved language is still supported
        const supportedLang = languages.find((lang) => lang.code === savedLanguage)
        if (supportedLang) return savedLanguage
      }

      // Get browser languages in order of preference
      const browserLanguages = navigator.languages || [navigator.language]

      // Check each browser language against supported languages
      for (const browserLang of browserLanguages) {
        const langCode = browserLang.split("-")[0].toLowerCase()

        // Check if we support this language
        const supportedLang = languages.find((lang) => lang.code === langCode)
        if (supportedLang) return langCode
      }

      return "en" // Default to English
    }
    return "en" // Default to English
  }

  // Enhanced translation function with caching and fallbacks
  const t = (key: string, params?: Record<string, any>): string => {
    try {
      if (!translations || typeof translations !== "object") {
        console.warn("Translations not loaded properly")
        return key
      }

      let translatedText = translations[key]

      // If translation doesn't exist, try fallback
      if (!translatedText) {
        translatedText = translateWithFallback(key, translations, getTranslations("en"))

        // If still no translation, record it as missing and return the key
        if (translatedText === key) {
          if (process.env.NODE_ENV === "development") {
            missingTranslationsRef.current.add(key)
          }
        }
      }

      // Replace parameters if they exist
      if (params && translatedText) {
        translatedText = translateWithParams(key, params, translations)
      }

      return translatedText
    } catch (error) {
      console.error("Translation error:", error)
      return key
    }
  }

  // Function to get translation with fallback
  const translateWithFallbackFunc = (key: string, fallbackLanguage = "en"): string => {
    return translateWithFallback(key, translations, getTranslations(fallbackLanguage))
  }

  // Function to get translation coverage
  const getTranslationCoverage = (): number => {
    if (!translations) return 0

    const totalKeys = Object.keys(translations).length
    const translatedKeys = Object.values(translations).filter((value) => value && value.trim()).length

    return totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0
  }

  // Function to translate all elements with data-i18n attribute
  const translateDataAttributes = () => {
    try {
      if (typeof document === "undefined") return

      const elements = document.querySelectorAll("[data-i18n]")
      elements.forEach((element) => {
        const key = element.getAttribute("data-i18n")
        if (key) {
          const translation = t(key)
          if (translation && translation !== key) {
            element.textContent = translation
          }
        }
      })
    } catch (error) {
      console.warn("Error translating data attributes:", error)
    }
  }

  // Load saved language preference or detect browser language on initial load
  useEffect(() => {
    if (!isInitialRender.current) return
    isInitialRender.current = false

    const initializeLanguage = async () => {
      try {
        setIsLoading(true)

        const initialLanguageCode = detectBrowserLanguage()
        const initialLanguage = languages.find((lang) => lang.code === initialLanguageCode)

        // Cache initial translations
        const initialTranslations = getTranslations(initialLanguageCode)
        translationCacheRef.current.set(initialLanguageCode, initialTranslations)

        // Update state
        setCurrentLanguage(initialLanguage || defaultLanguage)
        setIsRTL((initialLanguage || defaultLanguage).direction === "rtl")
        setTranslations(initialTranslations)
        previousLanguageRef.current = initialLanguageCode

        // Set document direction and language only in browser
        if (typeof document !== "undefined") {
          document.documentElement.dir = (initialLanguage || defaultLanguage).direction
          document.documentElement.lang = (initialLanguage || defaultLanguage).code

          // Add language-specific class to body
          document.body.classList.add(`lang-${initialLanguageCode}`)
          if ((initialLanguage || defaultLanguage).direction === "rtl") {
            document.body.classList.add("rtl")
          }

          // Translate the entire document on initial load
          setTimeout(() => {
            translateDataAttributes()
          }, 0)
        }

        setIsReady(true)
      } catch (error) {
        console.error("Error initializing language:", error)
        // Ensure we always have a valid state
        setCurrentLanguage(defaultLanguage)
        setIsRTL(false)
        setTranslations(getTranslations("en"))
        setIsReady(true)
      } finally {
        setIsLoading(false)
      }
    }

    initializeLanguage()
  }, [])

  // Enhanced function to change language with complete cleanup
  const changeLanguage = (code: string) => {
    const newLanguage = languages.find((lang) => lang.code === code)

    // Check if the language is supported
    if (!newLanguage) {
      console.warn(`Language ${code} is not supported, falling back to English`)
      return
    }

    // Don't change if it's the same language
    if (previousLanguageRef.current === code) {
      console.log(`Already using language ${code}`)
      return
    }

    setIsLoading(true)

    try {
      console.log(`🌐 Changing language from ${previousLanguageRef.current} to ${code}`)

      setCurrentLanguage(newLanguage)
      setIsRTL(newLanguage.direction === "rtl")

      // Load translations for the new language (with caching)
      let newTranslations = translationCacheRef.current.get(code)
      if (!newTranslations) {
        newTranslations = getTranslations(code)
        translationCacheRef.current.set(code, newTranslations)
      }

      setTranslations(newTranslations)

      // Save language preference
      if (typeof window !== "undefined") {
        localStorage.setItem("preferredLanguage", code)
      }

      // Force complete retranslation to remove all traces of previous language
      if (typeof document !== "undefined") {
        // Remove all previous language classes
        document.body.classList.forEach((className) => {
          if (className.startsWith("lang-") || className === "rtl" || className === "ltr") {
            document.body.classList.remove(className)
          }
        })

        // Add new language classes
        document.body.classList.add(`lang-${code}`)
        if (newLanguage.direction === "rtl") {
          document.body.classList.add("rtl")
        } else {
          document.body.classList.add("ltr")
        }

        // Update document properties
        document.documentElement.dir = newLanguage.direction
        document.documentElement.lang = newLanguage.code

        // Force complete retranslation after a short delay
        setTimeout(() => {
          forceCompleteRetranslation(code, newTranslations)

          // Trigger custom event for components to re-render
          window.dispatchEvent(
            new CustomEvent("languageChanged", {
              detail: {
                language: newLanguage,
                translations: newTranslations,
                previousLanguage: previousLanguageRef.current,
              },
            }),
          )
        }, 100)
      }

      // Update previous language reference
      previousLanguageRef.current = code

      // Clear missing translations for new language
      missingTranslationsRef.current.clear()

      console.log(`✅ Language successfully changed to ${code}`)
    } catch (error) {
      console.error("Error changing language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to force complete retranslation of the page
  const forceRetranslate = () => {
    if (typeof document !== "undefined" && translations && isReady) {
      try {
        console.log(`🔄 Force retranslating page to ${currentLanguage.code}`)
        forceCompleteRetranslation(currentLanguage.code, translations)
        console.log(`✅ Force retranslation completed`)
      } catch (error) {
        console.warn("Error in force retranslation:", error)
      }
    }
  }

  // Function to translate a specific element
  const translateElementWithCurrentTranslations = (element: Element): void => {
    try {
      translateElement(element, translations)
    } catch (error) {
      console.warn("Element translation error:", error)
    }
  }

  // Set up MutationObserver to watch for dynamically added content
  useEffect(() => {
    if (typeof window !== "undefined" && !observerRef.current && isReady) {
      observerRef.current = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Small delay to ensure the element is fully rendered
                setTimeout(() => {
                  translateElementWithCurrentTranslations(node as Element)
                }, 50)
              }
            })
          }
        })
      })

      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
      })
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [isReady, translations])

  // Translate the entire document when translations change
  useEffect(() => {
    if (typeof document !== "undefined" && !isLoading && translations && isReady) {
      try {
        translateDocument(currentLanguage.code, translations)
      } catch (error) {
        console.warn("Document translation error:", error)
      }
    }
  }, [translations, isLoading, currentLanguage.code, isReady])

  const setLanguage = (language: Language) => {
    changeLanguage(language.code)
  }

  const value = {
    currentLanguage,
    setLanguage,
    changeLanguage,
    t,
    isLoading,
    supportedLanguages: languages,
    translateWithFallback: translateWithFallbackFunc,
    getTranslationCoverage,
    forceRetranslate,
    isReady,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
