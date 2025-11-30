"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { type Language, languages, defaultLanguage } from "./languages"
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
  const [currentLanguage, setCurrentLanguage] = useState<Language>(defaultLanguage)
  const [translations, setTranslations] = useState<Record<string, string>>(
    getTranslations(defaultLanguage.code)
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isRTL, setIsRTL] = useState(defaultLanguage.direction === "rtl")
  const missingTranslationsRef = useRef<Set<string>>(new Set())
  const observerRef = useRef<MutationObserver | null>(null)
  const isInitialRender = useRef(true)
  const translationCacheRef = useRef<Map<string, Record<string, string>>>(new Map())
  const previousLanguageRef = useRef<string>(defaultLanguage.code)

  // Всегда по умолчанию возвращаем uk, если нет сохранённого языка
  const detectBrowserLanguage = () => {
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("preferredLanguage")
      if (savedLanguage) {
        const supportedLang = languages.find((lang) => lang.code === savedLanguage)
        if (supportedLang) return supportedLang.code
      }
      return defaultLanguage.code
    }
    return defaultLanguage.code
  }

  // Основная функция перевода по ключу
  const t = (key: string, params?: Record<string, any>): string => {
    try {
      if (!translations || typeof translations !== "object") {
        console.warn("Translations not loaded properly")
        return key
      }

      let translatedText = translations[key]

      // Если нет перевода — берём из английского
      if (!translatedText) {
        translatedText = translateWithFallbackUtil(key, translations, getTranslations("en"))

        if (translatedText === key) {
          if (process.env.NODE_ENV === "development") {
            missingTranslationsRef.current.add(key)
          }
        }
      }

      // Подстановка параметров {{param}}
      if (params && translatedText) {
        translatedText = translateWithParams(key, params, translations)
      }

      return translatedText
    } catch (error) {
      console.error("Translation error:", error)
      return key
    }
  }

  // Публичная функция с выбором fallback-языка (по умолчанию en)
  const translateWithFallbackFunc = (key: string, fallbackLanguage = "en"): string => {
    return translateWithFallbackUtil(key, translations, getTranslations(fallbackLanguage))
  }

  // Покрытие переводами (для отладки)
  const getTranslationCoverage = (): number => {
    if (!translations) return 0

    const totalKeys = Object.keys(translations).length
    const translatedKeys = Object.values(translations).filter(
      (value) => value && value.trim(),
    ).length

    return totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0
  }

  // Перевод элементов с data-i18n
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

  // Инициализация языка при первом рендере
  useEffect(() => {
    if (!isInitialRender.current) return
    isInitialRender.current = false

    const initializeLanguage = async () => {
      try {
        setIsLoading(true)

        const initialLanguageCode = detectBrowserLanguage()
        const initialLanguage =
          languages.find((lang) => lang.code === initialLanguageCode) || defaultLanguage

        const initialTranslations = getTranslations(initialLanguage.code)
        translationCacheRef.current.set(initialLanguage.code, initialTranslations)

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

        setCurrentLanguage(defaultLanguage)
        setIsRTL(defaultLanguage.direction === "rtl")
        const fallbackTranslations = getTranslations(defaultLanguage.code)
        setTranslations(fallbackTranslations)
        previousLanguageRef.current = defaultLanguage.code
        setIsReady(true)
      } finally {
        setIsLoading(false)
      }
    }

    void initializeLanguage()
  }, [])

  // Смена языка
  const changeLanguage = (code: string) => {
    const newLanguage = languages.find((lang) => lang.code === code)

    if (!newLanguage) {
      console.warn(
        `Language ${code} is not supported, falling back to ${defaultLanguage.code}`,
      )
      return
    }

    if (previousLanguageRef.current === code) {
      return
    }

    setIsLoading(true)

    try {
      setCurrentLanguage(newLanguage)
      setIsRTL(newLanguage.direction === "rtl")

      let newTranslations = translationCacheRef.current.get(code)
      if (!newTranslations) {
        newTranslations = getTranslations(code)
        translationCacheRef.current.set(code, newTranslations)
      }

      setTranslations(newTranslations)

      if (typeof window !== "undefined") {
        localStorage.setItem("preferredLanguage", code)
      }

      if (typeof document !== "undefined") {
        // Чистим старые классы языка / направления
        document.body.classList.forEach((className) => {
          if (
            className.startsWith("lang-") ||
            className === "rtl" ||
            className === "ltr"
          ) {
            document.body.classList.remove(className)
          }
        })

        // Добавляем новые классы
        document.body.classList.add(`lang-${code}`)
        document.body.classList.add(newLanguage.direction === "rtl" ? "rtl" : "ltr")

        // Обновляем html-атрибуты
        document.documentElement.dir = newLanguage.direction
        document.documentElement.lang = newLanguage.code

        // Форсим полную перетрансляцию
        setTimeout(() => {
          forceCompleteRetranslation(code, newTranslations as Record<string, string>)

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

      previousLanguageRef.current = code
      missingTranslationsRef.current.clear()
    } catch (error) {
      console.error("Error changing language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Явный форс-перевод текущей страницы
  const forceRetranslate = () => {
    if (typeof document !== "undefined" && translations && isReady) {
      try {
        forceCompleteRetranslation(currentLanguage.code, translations)
      } catch (error) {
        console.warn("Error in force retranslation:", error)
      }
    }
  }

  // Перевод конкретного элемента
  const translateElementWithCurrentTranslations = (element: Element): void => {
    try {
      translateElement(element, translations)
    } catch (error) {
      console.warn("Element translation error:", error)
    }
  }

  // Наблюдатель за динамическим контентом
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

  // Перевод всего документа при смене словаря
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
