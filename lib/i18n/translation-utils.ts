// @ts-nocheck
"use client"

// Enhanced translation utilities for comprehensive multilingual support

/**
 * Translation validation result interface
 */
interface TranslationValidationResult {
  isValid: boolean
  missingKeys: string[]
  errors: string[]
}

/**
 * Extracts all text nodes from an element, including nested elements
 */
export function extractTextNodes(element: Element): Text[] {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return node.textContent && node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    if (textNode.textContent && textNode.textContent.trim()) {
      textNodes.push(textNode)
    }
  }

  return textNodes
}

/**
 * Comprehensive element translation with complete text replacement
 */
export function translateElement(element: Element, translations: Record<string, string>): void {
  try {
    // Skip elements marked as no-translate
    if (element.hasAttribute("data-no-translate") || element.closest("[data-no-translate]")) {
      return
    }

    // Handle data-i18n attribute first (highest priority)
    const i18nKey = element.getAttribute("data-i18n")
    if (i18nKey && translations[i18nKey]) {
      element.textContent = translations[i18nKey]
      return
    }

    // Handle common translatable attributes
    const translatableAttributes = [
      "placeholder",
      "title",
      "alt",
      "aria-label",
      "aria-description",
      "data-tooltip",
      "value",
    ]

    translatableAttributes.forEach((attr) => {
      const attrValue = element.getAttribute(attr)
      if (attrValue && translations[attrValue]) {
        element.setAttribute(attr, translations[attrValue])
      }
    })

    // Handle text content for leaf elements (no children)
    if (element.children.length === 0 && element.textContent) {
      const text = element.textContent.trim()
      if (text && translations[text]) {
        element.textContent = translations[text]
      }
    } else {
      // For elements with children, check direct text nodes
      const childNodes = Array.from(element.childNodes)
      childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          const text = node.textContent.trim()
          if (text && translations[text]) {
            node.textContent = translations[text]
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Recursively translate child elements
          translateElement(node as Element, translations)
        }
      })
    }
  } catch (error) {
    console.warn("Error translating element:", error)
  }
}

/**
 * Complete document translation with thorough coverage
 */
export function translateDocument(languageCode: string, translations: Record<string, string> = {}): void {
  try {
    // Ensure we're in browser environment
    if (typeof document === "undefined") {
      console.warn("translateDocument called in non-browser environment")
      return
    }

    console.log(`🌐 Starting complete document translation to ${languageCode}`)

    // Update document language and direction
    document.documentElement.lang = languageCode
    document.documentElement.dir = getTextDirection(languageCode)

    // Update page title if it has a translation key
    const titleElement = document.querySelector("title")
    if (titleElement) {
      const titleText = titleElement.textContent?.trim()
      if (titleText && translations[titleText]) {
        titleElement.textContent = translations[titleText]
      }
    }

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      const content = metaDescription.getAttribute("content")
      if (content && translations[content]) {
        metaDescription.setAttribute("content", translations[content])
      }
    }

    // Translate all elements with data-i18n attributes (highest priority)
    const elementsWithI18n = document.querySelectorAll("[data-i18n]")
    elementsWithI18n.forEach((element) => {
      const key = element.getAttribute("data-i18n")
      if (key && translations[key]) {
        element.textContent = translations[key]
      }
    })

    // Comprehensive translation of all text-containing elements
    const textSelectors = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6", // Headings
      "p",
      "span",
      "div",
      "a",
      "li",
      "td",
      "th", // Text containers
      "button",
      "label",
      "legend",
      "option", // Form elements
      "[placeholder]",
      "[title]",
      "[alt]",
      "[aria-label]", // Attributes
    ]

    textSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector)
      elements.forEach((element) => {
        translateElement(element, translations)
      })
    })

    // Special handling for form elements
    const formElements = document.querySelectorAll("input, textarea, select")
    formElements.forEach((element) => {
      // Translate placeholder
      const placeholder = element.getAttribute("placeholder")
      if (placeholder && translations[placeholder]) {
        element.setAttribute("placeholder", translations[placeholder])
      }

      // Translate title
      const title = element.getAttribute("title")
      if (title && translations[title]) {
        element.setAttribute("title", translations[title])
      }

      // Translate aria-label
      const ariaLabel = element.getAttribute("aria-label")
      if (ariaLabel && translations[ariaLabel]) {
        element.setAttribute("aria-label", translations[ariaLabel])
      }

      // For select options
      if (element.tagName === "SELECT") {
        const options = element.querySelectorAll("option")
        options.forEach((option) => {
          const optionText = option.textContent?.trim()
          if (optionText && translations[optionText]) {
            option.textContent = translations[optionText]
          }
        })
      }
    })

    // Translate all text nodes in the body
    if (document.body) {
      translateAllTextNodes(document.body, translations)
    }

    console.log(`✅ Document translation to ${languageCode} completed`)
  } catch (error) {
    console.warn("Error translating document:", error)
  }
}

/**
 * Translate all text nodes in an element recursively
 */
function translateAllTextNodes(element: Element, translations: Record<string, string>): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip text nodes in script, style, or no-translate elements
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT

      if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") {
        return NodeFilter.FILTER_REJECT
      }

      if (parent.hasAttribute("data-no-translate") || parent.closest("[data-no-translate]")) {
        return NodeFilter.FILTER_REJECT
      }

      return node.textContent && node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent?.trim()
    if (text && translations[text]) {
      textNode.textContent = translations[text]
    }
  })
}

/**
 * Force complete page retranslation - removes all previous language traces
 */
export function forceCompleteRetranslation(languageCode: string, translations: Record<string, string>): void {
  try {
    if (typeof document === "undefined") return

    console.log(`🔄 Force retranslating entire page to ${languageCode}`)

    // Clear any language-specific classes
    document.body.classList.forEach((className) => {
      if (className.startsWith("lang-") || className === "rtl" || className === "ltr") {
        document.body.classList.remove(className)
      }
    })

    // Add new language class
    document.body.classList.add(`lang-${languageCode}`)
    if (getTextDirection(languageCode) === "rtl") {
      document.body.classList.add("rtl")
    } else {
      document.body.classList.add("ltr")
    }

    // Update document properties
    document.documentElement.lang = languageCode
    document.documentElement.dir = getTextDirection(languageCode)

    // Force complete retranslation
    translateDocument(languageCode, translations)

    // Trigger custom event for components to update
    window.dispatchEvent(
      new CustomEvent("forceLanguageUpdate", {
        detail: { languageCode, translations },
      }),
    )

    console.log(`✅ Force retranslation to ${languageCode} completed`)
  } catch (error) {
    console.error("Error in force retranslation:", error)
  }
}

/**
 * Translates text with parameter replacement
 */
export function translateWithParams(
  key: string,
  params: Record<string, string>,
  translations: Record<string, string> = {},
): string {
  let text = translations[key] || key

  // Replace parameters
  Object.entries(params).forEach(([paramKey, paramValue]) => {
    text = text.replace(new RegExp(`{{${paramKey}}}`, "g"), paramValue)
  })

  return text
}

/**
 * Translates with fallback language support
 */
export function translateWithFallback(
  key: string,
  primaryTranslations: Record<string, string>,
  fallbackTranslations: Record<string, string>,
): string {
  return primaryTranslations[key] || fallbackTranslations[key] || key
}

/**
 * Gets the appropriate locale string for speech recognition and synthesis
 */
export function getLocaleForLanguage(languageCode: string): string {
  const localeMap: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    uk: "uk-UA",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
    pl: "pl-PL",
    tr: "tr-TR",
    ar: "ar-SA",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    vi: "vi-VN",
    he: "he-IL",
    el: "el-GR",
    sv: "sv-SE",
    da: "da-DK",
    et: "et-EE",
    lv: "lv-LV",
    lt: "lt-LT",
    ro: "ro-RO",
    az: "az-AZ",
    kk: "kk-KZ",
    ky: "ky-KG",
    tg: "tg-TJ",
    uz: "uz-UZ",
  }

  return localeMap[languageCode] || "en-US"
}

/**
 * Gets native voice preferences for each language with accent authenticity - UPDATED with correct Google Cloud TTS names
 */
export function getNativeVoicePreferences(): Record<string, Record<string, string[]>> {
  return {
    en: {
      female: [
        "Microsoft Hazel Desktop - English (Great Britain)",
        "Google UK English Female",
        "Microsoft Susan Desktop - English (United States)",
        "en-GB-SoniaNeural",
        "en-GB-LibbyNeural",
        "en-US-JennyNeural",
        "en-US-AriaNeural",
        "Microsoft Zira Desktop - English (United States)",
        "Google US English Female",
        "Samantha",
        "Victoria",
        "Karen",
        "Moira",
        "Tessa",
        "Veena",
        "Fiona",
        "Allison",
        "Ava (Enhanced)",
        "Serena",
      ],
      male: [
        "Microsoft George Desktop - English (Great Britain)",
        "Google UK English Male",
        "Microsoft David Desktop - English (United States)",
        "en-GB-RyanNeural",
        "en-GB-ThomasNeural",
        "en-US-GuyNeural",
        "en-US-BrandonNeural",
        "Google US English Male",
        "Microsoft David",
        "Alex",
        "Daniel",
        "Tom",
        "Oliver",
        "Arthur",
        "Thomas",
        "Fred",
      ],
    },
    tr: {
      female: [
        "tr-TR-EmelNeural",
        "tr-TR-SerapNeural",
        "Microsoft Tolga Desktop - Turkish (Turkey)",
        "Google Türkçe (female)",
        "tr-TR-female",
        "Turkish Female",
        "Ayşe",
        "Fatma",
        "Zeynep",
        "Elif",
        "Selin",
      ],
      male: [
        "tr-TR-AhmetNeural",
        "tr-TR-BurakNeural",
        "Microsoft Tolga Desktop - Turkish (Turkey)",
        "Google Türkçe (male)",
        "tr-TR-male",
        "Turkish Male",
        "Mehmet",
        "Ali",
        "Mustafa",
        "Emre",
        "Kemal",
      ],
    },
    ru: {
      female: [
        // Correct Google Cloud TTS voice names for Russian
        "ru-RU-Wavenet-A",
        "ru-RU-Wavenet-C",
        "ru-RU-Standard-A",
        "ru-RU-Standard-C",
        // Browser TTS fallbacks
        "Microsoft Irina Desktop - Russian (Russia)",
        "Google русский женский премиум",
        "Microsoft Irina Enhanced - Russian",
        "Svetlana Professional Voice",
        "Elena Therapeutic Voice",
        "Katya Natural Voice",
        "Oksana Premium Voice",
        "Dariya Enhanced Voice",
        "Milena Therapeutic Voice",
        "Anastasia Premium Voice",
        "Vera Natural Voice",
        "Microsoft Irina - Russian (Russia)",
        "Google русский (female)",
        "Russian Female Premium",
        "Русский женский премиум",
        "Русский женский голос",
        "Russian Female Natural",
        "Русская женщина",
      ],
      male: [
        // Correct Google Cloud TTS voice names for Russian
        "ru-RU-Wavenet-B",
        "ru-RU-Wavenet-D",
        "ru-RU-Standard-B",
        "ru-RU-Standard-D",
        // Browser TTS fallbacks
        "Microsoft Pavel Desktop - Russian (Russia)",
        "Google русский мужской премиум",
        "Microsoft Pavel Enhanced - Russian",
        "Dmitry Professional Voice",
        "Aleksandr Therapeutic Voice",
        "Pavel Natural Voice",
        "Maxim Premium Voice",
        "Sergey Enhanced Voice",
        "Mikhail Therapeutic Voice",
        "Andrey Premium Voice",
        "Igor Natural Voice",
        "Nikolai Professional Voice",
        "Vladimir Premium Voice",
        "Microsoft Pavel - Russian (Russia)",
        "Google русский (male)",
        "Russian Male Premium",
        "Русский мужской премиум",
        "Русский мужской голос",
        "Russian Male Natural",
        "Русский мужчина",
      ],
    },
    uk: {
      female: [
        // Correct Google Cloud TTS voice names for Ukrainian
        "uk-UA-Standard-A",
        "uk-UA-Wavenet-A",
        // Browser TTS fallbacks
        "Google Українська (female)",
        "Google Українська",
        "Ukrainian Female",
        "uk-UA-female",
        // Enhanced Russian female fallbacks for Ukrainian
        "ru-RU-Wavenet-A",
        "ru-RU-Wavenet-C",
        "ru-RU-Standard-A",
        "Microsoft Irina Desktop - Russian (Russia)",
        "Google русский (female)",
        "Microsoft Irina (female)",
        "Milena",
        "Katya Premium",
      ],
      male: [
        // Correct Google Cloud TTS voice names for Ukrainian
        "uk-UA-Wavenet-B",
        "uk-UA-Standard-B",
        // Browser TTS fallbacks
        "Google Українська (male)",
        "Google Українська",
        "Ukrainian Male",
        "uk-UA-male",
        // Enhanced Russian male fallbacks for Ukrainian
        "ru-RU-Wavenet-B",
        "ru-RU-Wavenet-D",
        "ru-RU-Standard-B",
        "Microsoft Pavel Desktop - Russian (Russia)",
        "Google русский (male)",
        "Microsoft Pavel (male)",
        "Maxim",
        "Dmitry Professional",
      ],
    },
    es: {
      female: [
        "es-ES-ElviraNeural",
        "es-ES-AbrilNeural",
        "Microsoft Helena Desktop - Spanish (Spain)",
        "Google español (female)",
        "es-ES-female",
        "Spanish Female",
        "Mónica",
        "Esperanza",
        "Paloma",
      ],
      male: [
        "es-ES-AlvaroNeural",
        "es-ES-ArnauNeural",
        "Microsoft Pablo Desktop - Spanish (Spain)",
        "Google español (male)",
        "es-ES-male",
        "Spanish Male",
        "Jorge",
        "Diego",
        "Carlos",
      ],
    },
    fr: {
      female: [
        "fr-FR-DeniseNeural",
        "fr-FR-EloiseNeural",
        "Microsoft Hortense Desktop - French (France)",
        "Google français (female)",
        "fr-FR-female",
        "French Female",
        "Amélie",
        "Céline",
        "Marie",
      ],
      male: [
        "fr-FR-HenriNeural",
        "fr-FR-ClaudeNeural",
        "Microsoft Paul Desktop - French (France)",
        "Google français (male)",
        "fr-FR-male",
        "French Male",
        "Thomas",
        "Henri",
        "Pierre",
      ],
    },
    de: {
      female: [
        "de-DE-KatjaNeural",
        "de-DE-AmalaNeural",
        "Microsoft Katja Desktop - German (Germany)",
        "Google Deutsch (female)",
        "de-DE-female",
        "German Female",
        "Anna",
        "Petra",
        "Marlene",
      ],
      male: [
        "de-DE-ConradNeural",
        "de-DE-KillianNeural",
        "Microsoft Stefan Desktop - German (Germany)",
        "Google Deutsch (male)",
        "de-DE-male",
        "German Male",
        "Hans",
        "Ralf",
        "Markus",
      ],
    },
    it: {
      female: [
        "it-IT-ElsaNeural",
        "it-IT-IsabellaNeural",
        "Microsoft Elsa Desktop - Italian (Italy)",
        "Google italiano (female)",
        "it-IT-female",
        "Italian Female",
        "Alice",
        "Federica",
        "Paola",
      ],
      male: [
        "it-IT-DiegoNeural",
        "it-IT-BenignoNeural",
        "Microsoft Cosimo Desktop - Italian (Italy)",
        "Google italiano (male)",
        "it-IT-male",
        "Italian Male",
        "Luca",
        "Giorgio",
        "Marco",
      ],
    },
  }
}

/**
 * Gets optimal speech parameters for native accent authenticity
 */
export function getNativeSpeechParameters(languageCode: string, gender: "male" | "female") {
  const parameters: Record<string, Record<string, { rate: number; pitch: number; volume: number }>> = {
    tr: {
      female: {
        rate: 0.85, // Optimal for Turkish female pronunciation
        pitch: 1.1, // Natural Turkish female intonation
        volume: 0.98,
      },
      male: {
        rate: 0.82, // Turkish male speech pattern
        pitch: 0.9, // Turkish male intonation
        volume: 0.98,
      },
    },
    ru: {
      female: {
        rate: 0.82, // Optimal for Russian female pronunciation
        pitch: 1.12, // Natural Russian female intonation
        volume: 0.95, // Gentle therapeutic volume
      },
      male: {
        rate: 0.78, // Slightly slower for Russian male clarity
        pitch: 0.88, // Deep, warm Russian male tone
        volume: 0.97, // Confident but gentle volume
      },
    },
    uk: {
      female: {
        rate: 0.88, // Ukrainian female speech pattern
        pitch: 1.08, // Ukrainian female intonation
        volume: 0.98,
      },
      male: {
        rate: 0.82, // Ukrainian male speech pattern (slower, calmer)
        pitch: 0.88, // Deeper warm Ukrainian male tone
        volume: 0.98,
      },
    },
    en: {
      female: {
        rate: 0.92, // Natural English female pace
        pitch: 1.05, // Professional English female tone
        volume: 1.0,
      },
      male: {
        rate: 0.9, // Natural English male pace
        pitch: 0.98, // Professional English male tone
        volume: 1.0,
      },
    },
    es: {
      female: {
        rate: 0.9,
        pitch: 1.1,
        volume: 1.0,
      },
      male: {
        rate: 0.88,
        pitch: 0.95,
        volume: 1.0,
      },
    },
    fr: {
      female: {
        rate: 0.87,
        pitch: 1.08,
        volume: 1.0,
      },
      male: {
        rate: 0.85,
        pitch: 0.96,
        volume: 1.0,
      },
    },
    de: {
      female: {
        rate: 0.83,
        pitch: 1.06,
        volume: 1.0,
      },
      male: {
        rate: 0.81,
        pitch: 0.94,
        volume: 1.0,
      },
    },
    it: {
      female: {
        rate: 0.91,
        pitch: 1.12,
        volume: 1.0,
      },
      male: {
        rate: 0.89,
        pitch: 0.97,
        volume: 1.0,
      },
    },
  }

  return parameters[languageCode]?.[gender] || { rate: 0.9, pitch: 1.0, volume: 1.0 }
}

/**
 * Extract plain text from various response formats
 */
export function extractPlainText(response: any): string {
  if (typeof response === "string") {
    return response
  }

  if (response && typeof response === "object") {
    if (response.output !== undefined) return extractPlainText(response.output)
    if (response.response !== undefined) return extractPlainText(response.response)
    if (response.message !== undefined) return extractPlainText(response.message)
    if (response.text !== undefined) return extractPlainText(response.text)
    if (response.answer !== undefined) return extractPlainText(response.answer)
    if (response.result !== undefined) return extractPlainText(response.result)
    if (response.content !== undefined) return extractPlainText(response.content)

    if (Array.isArray(response)) {
      if (response.length > 0) {
        return extractPlainText(response[0])
      }
      return ""
    }

    for (const key in response) {
      if (typeof response[key] === "string") {
        return response[key]
      }
      if (response[key] && typeof response[key] === "object") {
        const extracted = extractPlainText(response[key])
        if (extracted) return extracted
      }
    }

    return JSON.stringify(response)
  }

  return String(response || "")
}

/**
 * Language detection utility
 */
export function detectLanguage(text: string): string {
  // Check for Turkish characters
  if (/[çğıöşüÇĞIİÖŞÜ]/.test(text)) {
    return "tr"
  }

  // Check for Cyrillic characters (Russian, Ukrainian, etc.)
  if (/[\u0400-\u04FF]/.test(text)) {
    // Differentiate between Ukrainian and Russian (very basic)
    if (/[іїєґ]/i.test(text)) {
      return "uk" // Ukrainian
    } else {
      return "ru" // Russian
    }
  }

  // Check for Arabic characters
  if (/[\u0600-\u06FF]/.test(text)) {
    return "ar"
  }

  // Check for Chinese characters
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return "zh"
  }

  // Check for Japanese characters
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return "ja"
  }

  // Check for Korean characters
  if (/[\uAC00-\uD7AF]/.test(text)) {
    return "ko"
  }

  // Default to English
  return "en"
}

/**
 * Clean response text utility
 */
export function cleanResponseText(text: string): string {
  if (!text) return ""

  // Handle the specific format [{"output":" text"}]
  if (text.startsWith('[{"output":')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) {
        return parsed[0].output.trim()
      }
    } catch (e) {
      console.log("Failed to parse response format:", e)
    }
  }

  return text
    .replace(/\n\n/g, " ") // Replace double newlines with spaces
    .replace(/\*\*/g, "") // Remove asterisks (markdown bold)
    .replace(/\n/g, " ") // Replace single newlines with spaces
    .replace(/```/g, "") // Remove code blocks
    .replace(/^\s*[{[]|\s*[}\]]$/g, "") // Remove outer braces/brackets
    .replace(/"output":|"response":|"text":|"message":/g, "") // Remove common JSON keys
    .replace(/["{}[\],]/g, "") // Remove quotes, braces, brackets, commas
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

/**
 * Format text for speech synthesis
 */
export function formatTextForSpeech(text: string): string {
  return cleanResponseText(text)
    .replace(/([.!?])\s*([A-Z])/g, "$1 $2") // Ensure proper pauses between sentences
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

/**
 * Check if a language uses right-to-left text direction
 */
export function isRTLLanguage(languageCode: string): boolean {
  const rtlLanguages = ["ar", "he", "fa", "ur"]
  return rtlLanguages.includes(languageCode)
}

/**
 * Get text direction for a language
 */
export function getTextDirection(languageCode: string): "ltr" | "rtl" {
  return isRTLLanguage(languageCode) ? "rtl" : "ltr"
}

/**
 * Validate language code
 */
export function isValidLanguageCode(code: string): boolean {
  const validCodes = [
    "en",
    "ru",
    "uk",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "pl",
    "tr",
    "ar",
    "zh",
    "ja",
    "ko",
    "vi",
    "he",
    "el",
    "sv",
    "da",
    "et",
    "lv",
    "lt",
    "ro",
    "az",
    "kk",
    "ky",
    "tg",
    "uz",
  ]
  return validCodes.includes(code)
}

/**
 * Get language name in its native script
 */
export function getNativeLanguageName(languageCode: string): string {
  const nativeNames: Record<string, string> = {
    en: "English",
    ru: "Русский",
    uk: "Українська",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    it: "Italiano",
    pt: "Português",
    pl: "Polski",
    tr: "Türkçe",
    ar: "العربية",
    zh: "中文",
    ja: "日本語",
    ko: "한국어",
    vi: "Tiếng Việt",
    he: "עברית",
    el: "Ελληνικά",
    sv: "Svenska",
    da: "Dansk",
    et: "Eesti",
    lv: "Latviešu",
    lt: "Lietuvių",
    ro: "Română",
    az: "Azərbaycan",
    kk: "Қазақша",
    ky: "Кыргызча",
    tg: "Тоҷикӣ",
    uz: "O'zbek",
  }

  return nativeNames[languageCode] || languageCode
}

/**
 * Extracts translatable strings from text or objects
 */
export function extractTranslatableStrings(content: any): string[] {
  const strings: string[] = []

  if (typeof content === "string") {
    // Skip URLs, emails, and other non-translatable content
    if (!isNonTranslatable(content)) {
      strings.push(content)
    }
  } else if (Array.isArray(content)) {
    content.forEach((item) => {
      strings.push(...extractTranslatableStrings(item))
    })
  } else if (typeof content === "object" && content !== null) {
    Object.values(content).forEach((value) => {
      strings.push(...extractTranslatableStrings(value))
    })
  }

  return [...new Set(strings)] // Remove duplicates
}

/**
 * Generates a translation template from an array of strings
 */
export function generateTranslationTemplate(strings: string[]): Record<string, string> {
  const template: Record<string, string> = {}

  strings.forEach((str) => {
    if (typeof str === "string" && str.trim()) {
      // Create a key from the string (simplified version)
      const key = str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50)

      template[key] = str
    }
  })

  return template
}

/**
 * Validates translation objects for completeness and correctness
 */
export function validateTranslations(
  baseTranslation: Record<string, any>,
  targetTranslation: Record<string, any>,
): TranslationValidationResult {
  const result: TranslationValidationResult = {
    isValid: true,
    missingKeys: [],
    errors: [],
  }

  // Check for missing keys
  const baseKeys = getAllKeys(baseTranslation)
  const targetKeys = getAllKeys(targetTranslation)

  baseKeys.forEach((key) => {
    if (!targetKeys.includes(key)) {
      result.missingKeys.push(key)
      result.isValid = false
    }
  })

  // Check for invalid values
  Object.entries(targetTranslation).forEach(([key, value]) => {
    if (typeof value !== "string" && typeof value !== "object") {
      result.errors.push(`Invalid value type for key "${key}"`)
      result.isValid = false
    }
  })

  return result
}

/**
 * Helper function to check if content should not be translated
 */
function isNonTranslatable(content: string): boolean {
  // URLs
  if (content.match(/^https?:\/\//)) return true

  // Email addresses
  if (content.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return true

  // File paths
  if (content.match(/^[./].*\.(js|ts|tsx|css|png|jpg|svg)$/)) return true

  // Numbers only
  if (content.match(/^\d+$/)) return true

  // Very short strings (likely not meaningful for translation)
  if (content.trim().length < 2) return true

  return false
}

/**
 * Helper function to get all keys from nested object
 */
function getAllKeys(obj: Record<string, any>, prefix = ""): string[] {
  const keys: string[] = []

  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  })

  return keys
}
