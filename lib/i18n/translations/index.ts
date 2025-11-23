import { en } from "./en"
import { ru } from "./ru"
import { uk } from "./uk"

export type TranslationsType = Record<string, string>

export type AvailableLanguages = "uk" | "en" | "ru"

export type TranslationsMap = Record<AvailableLanguages, TranslationsType>

const translationsMap: TranslationsMap = {
  uk,
  en,
  ru,
}

export const getTranslations = (languageCode: string): TranslationsType => {
  const code = languageCode as AvailableLanguages
  return translationsMap[code] || en
}
