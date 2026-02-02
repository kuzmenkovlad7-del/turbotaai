// @ts-nocheck
"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import {
  type Language,
  languages,
  defaultLanguage as baseDefaultLanguage,
} from "./languages"
import { getTranslations } from "./translations"
import {
  translateDocument,
  translateElement,
  translateWithFallback as translateWithFallbackUtil,
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

const resolvedDefaultLanguage: Language =
  languages.find((lang) => lang.code === "uk") ||
  baseDefaultLanguage ||
  languages[0]

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
)

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

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]).trim() || null : null
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

// Priority: 1) localStorage (manual user choice), 2) ta_lang cookie (set by middleware), 3) uk
const detectInitialLanguage = () => {
  if (typeof window === "undefined") return resolvedDefaultLanguage.code

  // User's explicit choice persists across sessions
  const savedLanguage = localStorage.getItem("preferredLanguage")
  if (savedLanguage) {
    const supportedLang = languages.find((lang) => lang.code === savedLanguage)
    if (supportedLang) return supportedLang.code
  }

  // Middleware-set default based on region
  const cookieLang = readCookie("ta_lang")
  if (cookieLang) {
    const supportedLang = languages.find((lang) => lang.code === cookieLang)
    if (supportedLang) return supportedLang.code
  }

  // Fallback: use region cookie to pick a sensible default
  const regionCookie = readCookie("ta_region")
  if (regionCookie === "INTL") {
    const enLang = languages.find((lang) => lang.code === "en")
    if (enLang) return enLang.code
  }

  return resolvedDefaultLanguage.code
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [currentLanguage, setCurrentLanguage] =
    useState<Language>(resolvedDefaultLanguage)
  const [translations, setTranslations] = useState<Record<string, string>>(
    getTranslations(resolvedDefaultLanguage.code),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isRTL, setIsRTL] = useState(
    resolvedDefaultLanguage.direction === "rtl",
  )

  const missingTranslationsRef = useRef<Set<string>>(new Set())
  const observerRef = useRef<MutationObserver | null>(null)
  const isInitialRender = useRef(true)
  const translationCacheRef = useRef<Map<string, Record<string, string>>>(
    new Map(),
  )
  const previousLanguageRef = useRef<string>(resolvedDefaultLanguage.code)

  // основной перевод по ключу
  const t = (key: string, params?: Record<string, any>): string => {
    try {
      if (!translations || typeof translations !== "object") return key

      let translatedText = translations[key]

      if (!translatedText) {
        translatedText = translateWithFallbackUtil(
          key,
          translations,
          getTranslations("en"),
        )

        if (translatedText === key && process.env.NODE_ENV === "development") {
          missingTranslationsRef.current.add(key)
        }
      }

      if (params && translatedText) {
        translatedText = translateWithParams(key, params, translations)
      }

      return translatedText
    } catch (error) {
      console.error("Translation error:", error)
      return key
    }
  }

  const translateWithFallbackFunc = (
    key: string,
    fallbackLanguage = "en",
  ): string => {
    return translateWithFallbackUtil(
      key,
      translations,
      getTranslations(fallbackLanguage),
    )
  }

  const getTranslationCoverage = (): number => {
    if (!translations) return 0

    const totalKeys = Object.keys(translations).length
    const translatedKeys = Object.values(translations).filter(
      (value) => value && value.trim(),
    ).length

    return totalKeys > 0
      ? Math.round((translatedKeys / totalKeys) * 100)
      : 0
  }

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

  // инициализация языка
  useEffect(() => {
    if (!isInitialRender.current) return
    isInitialRender.current = false

    const initializeLanguage = async () => {
      try {
        setIsLoading(true)

        const initialLanguageCode = detectInitialLanguage()
        const initialLanguage =
          languages.find((lang) => lang.code === initialLanguageCode) ||
          resolvedDefaultLanguage

        const initialTranslations = getTranslations(initialLanguage.code)
        translationCacheRef.current.set(
          initialLanguage.code,
          initialTranslations,
        )

        setCurrentLanguage(initialLanguage)
        setIsRTL(initialLanguage.direction === "rtl")
        setTranslations(initialTranslations)
        previousLanguageRef.current = initialLanguage.code

        if (typeof document !== "undefined") {
          document.documentElement.dir = initialLanguage.direction
          document.documentElement.lang = initialLanguage.code

          document.body.classList.add(`lang-${initialLanguage.code}`)
          document.body.classList.add(
            initialLanguage.direction === "rtl" ? "rtl" : "ltr",
          )

          setTimeout(() => {
            translateDataAttributes()
          }, 0)
        }

        setIsReady(true)
      } catch (error) {
        console.error("Error initializing language:", error)

        setCurrentLanguage(resolvedDefaultLanguage)
        setIsRTL(resolvedDefaultLanguage.direction === "rtl")
        const fallbackTranslations = getTranslations(
          resolvedDefaultLanguage.code,
        )
        setTranslations(fallbackTranslations)
        previousLanguageRef.current = resolvedDefaultLanguage.code
        setIsReady(true)
      } finally {
        setIsLoading(false)
      }
    }

    void initializeLanguage()
  }, [])

  const changeLanguage = (code: string) => {
    const newLanguage =
      languages.find((lang) => lang.code === code) || resolvedDefaultLanguage

    if (previousLanguageRef.current === newLanguage.code) return

    setIsLoading(true)

    try {
      setCurrentLanguage(newLanguage)
      setIsRTL(newLanguage.direction === "rtl")

      let newTranslations = translationCacheRef.current.get(newLanguage.code)
      if (!newTranslations) {
        newTranslations = getTranslations(newLanguage.code)
        translationCacheRef.current.set(newLanguage.code, newTranslations)
      }

      setTranslations(newTranslations)

      if (typeof window !== "undefined") {
        localStorage.setItem("preferredLanguage", newLanguage.code)
        writeCookie("ta_lang", newLanguage.code)
      }

      if (typeof document !== "undefined") {
        document.body.classList.forEach((className) => {
          if (
            className.startsWith("lang-") ||
            className === "rtl" ||
            className === "ltr"
          ) {
            document.body.classList.remove(className)
          }
        })

        document.body.classList.add(`lang-${newLanguage.code}`)
        document.body.classList.add(
          newLanguage.direction === "rtl" ? "rtl" : "ltr",
        )

        document.documentElement.dir = newLanguage.direction
        document.documentElement.lang = newLanguage.code

        setTimeout(() => {
          forceCompleteRetranslation(
            newLanguage.code,
            newTranslations as Record<string, string>,
          )

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

      previousLanguageRef.current = newLanguage.code
      missingTranslationsRef.current.clear()
    } catch (error) {
      console.error("Error changing language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const forceRetranslate = () => {
    if (typeof document !== "undefined" && translations && isReady) {
      try {
        forceCompleteRetranslation(currentLanguage.code, translations)
      } catch (error) {
        console.warn("Error in force retranslation:", error)
      }
    }
  }

  const translateElementWithCurrentTranslations = (element: Element): void => {
    try {
      translateElement(element, translations)
    } catch (error) {
      console.warn("Element translation error:", error)
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && !observerRef.current && isReady) {
      observerRef.current = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
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

  const value: LanguageContextType = {
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

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  )
}
