import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { getLocales } from "expo-localization"
import * as SecureStore from "expo-secure-store"
import { STORAGE_KEYS } from "@/constants/config"
import { translations, type Locale } from "@/constants/i18n"

const LANG_KEY = STORAGE_KEYS.LANGUAGE

/** Detect best locale from device settings */
function detectLocale(): Locale {
  try {
    const locales = getLocales()
    const tag = locales?.[0]?.languageCode ?? ""
    if (tag.startsWith("uk")) return "uk"
    if (tag.startsWith("ru")) return "ru"
  } catch {
    // fallback to "en"
  }
  return "en"
}

type LanguageContextValue = {
  locale: Locale
  t: typeof translations["en"]
  setLocale: (l: Locale) => void
}

export const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  t: translations.en,
  setLocale: () => {},
})

export function useLanguageProvider() {
  const [locale, setLocaleState] = useState<Locale>("en")
  const [ready, setReady] = useState(false)

  // Load persisted or detect on mount
  useEffect(() => {
    ;(async () => {
      try {
        const saved = await SecureStore.getItemAsync(LANG_KEY)
        if (saved && (saved === "en" || saved === "uk" || saved === "ru")) {
          setLocaleState(saved as Locale)
        } else {
          const detected = detectLocale()
          setLocaleState(detected)
          await SecureStore.setItemAsync(LANG_KEY, detected)
        }
      } catch {
        setLocaleState(detectLocale())
      }
      setReady(true)
    })()
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    SecureStore.setItemAsync(LANG_KEY, l).catch(() => {})
  }, [])

  return { locale, t: translations[locale], setLocale, ready }
}

/** Shortcut hook for consuming screens */
export function useT() {
  return useContext(LanguageContext)
}
