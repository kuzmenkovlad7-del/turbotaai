export interface Language {
  code: string
  label: string
  locale: string
  direction: "ltr" | "rtl"
  flag: string
}

export const languages = [
  {
    code: "uk",
    label: "Українська",
    locale: "uk-UA",
    direction: "ltr" as const,
    flag: "🇺🇦",
  },
  {
    code: "en",
    label: "English",
    locale: "en-US",
    direction: "ltr" as const,
    flag: "🇬🇧",
  },
  {
    code: "ru",
    label: "Русский",
    locale: "ru-RU",
    direction: "ltr" as const,
    flag: "🇷🇺",
  },
] as const

export type LanguageCode = (typeof languages)[number]["code"]

export const defaultLanguage = languages[0]

export const getLanguageByCode = (code: string): Language => {
  return languages.find((lang) => lang.code === code) || defaultLanguage
}
