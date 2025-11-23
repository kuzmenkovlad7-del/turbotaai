"use client"

import { useState, useMemo, useEffect } from "react"
import { Check, ChevronDown, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/lib/i18n/language-context"
import { languages } from "@/lib/i18n/languages"
import { cn } from "@/lib/utils"

export function LanguageSelector() {
  const { currentLanguage, changeLanguage, t, forceRetranslate, isLoading } = useLanguage()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isChanging, setIsChanging] = useState(false)

  const filteredLanguages = useMemo(() => {
    if (!searchQuery) return languages

    return languages.filter(
      (lang) =>
        lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [searchQuery])

  // Enhanced language change handler with complete cleanup
  const handleLanguageChange = async (code: string) => {
    if (isChanging || currentLanguage.code === code) return

    try {
      setIsChanging(true)
      console.log(`🌐 Language selector: Changing to ${code}`)

      // Close the popover immediately
      setOpen(false)
      setSearchQuery("")

      // Change the language with complete cleanup
      changeLanguage(code)

      // Wait a bit for the language change to propagate
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Force complete retranslation to ensure no residual text
      forceRetranslate()

      // Additional cleanup - force re-render of this component
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log(`✅ Language selector: Successfully changed to ${code}`)
    } catch (error) {
      console.error("Error in language change:", error)
    } finally {
      setIsChanging(false)
    }
  }

  // Listen for language change events to update the component
  useEffect(() => {
    const handleLanguageChanged = (event: CustomEvent) => {
      console.log("Language selector: Received language change event", event.detail)
      // Force component re-render by updating state
      setIsChanging(false)
    }

    window.addEventListener("languageChanged", handleLanguageChanged as EventListener)
    window.addEventListener("forceLanguageUpdate", handleLanguageChanged as EventListener)

    return () => {
      window.removeEventListener("languageChanged", handleLanguageChanged as EventListener)
      window.removeEventListener("forceLanguageUpdate", handleLanguageChanged as EventListener)
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t("Select Language")}
          disabled={isChanging || isLoading}
          className="flex items-center gap-1 sm:gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 w-[44px] sm:w-[180px] justify-between overflow-hidden bg-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-0 transition-colors"
        >
          <div className="flex items-center gap-1 sm:gap-2 truncate">
            <Globe className="h-4 w-4 shrink-0 hidden sm:block" />
            <span className="truncate">
              <span>{currentLanguage.flag}</span>
              <span className="hidden sm:inline ml-1">{currentLanguage.label}</span>
            </span>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", isChanging && "animate-spin")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-white border-slate-200 shadow-lg" align="end">
        <Command className="bg-white">
          <CommandInput
            placeholder={t("Search languages")}
            value={searchQuery}
            onValueChange={setSearchQuery}
            disabled={isChanging}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{t("No language found.")}</CommandEmpty>
            <CommandGroup>
              {filteredLanguages.map((language) => (
                <CommandItem
                  key={language.code}
                  value={`${language.label}-${language.code}`}
                  onSelect={() => handleLanguageChange(language.code)}
                  disabled={isChanging || currentLanguage.code === language.code}
                  className="flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="mr-1">{language.flag}</span>
                  {language.label}
                  <span className="ml-1 text-xs text-gray-500">({language.code})</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      currentLanguage.code === language.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
