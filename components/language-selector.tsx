"use client"

import { useState } from "react"
import { Check, ChevronDown, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/lib/i18n/language-context"
import { languages } from "@/lib/i18n/languages"
import { cn } from "@/lib/utils"

export function LanguageSelector() {
  const { currentLanguage, changeLanguage, t, isLoading } = useLanguage()
  const [open, setOpen] = useState(false)
  const [isChanging, setIsChanging] = useState(false)

  const handleLanguageChange = async (code: string) => {
    if (isChanging || currentLanguage.code === code) return

    try {
      setIsChanging(true)
      setOpen(false)
      changeLanguage(code)
      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch (error) {
      console.error("Error in language change:", error)
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={t("Select Language")}
          disabled={isChanging || isLoading}
          size="sm"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline text-sm">{currentLanguage.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-1 bg-white border-border shadow-lg" align="end">
        <div className="flex flex-col gap-0.5">
          {languages.map((language) => {
            const isActive = currentLanguage.code === language.code
            return (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                disabled={isChanging || isActive}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-md transition-colors text-left disabled:cursor-not-allowed",
                  isActive
                    ? "bg-accent/10 text-foreground border-l-2 border-accent"
                    : "text-foreground hover:bg-accent/10 hover:text-foreground"
                )}
              >
                <span className="text-base">{language.flag}</span>
                <span className="flex-1">{language.label}</span>
                <span className="text-xs text-gray-500">({language.code})</span>
                {isActive && (
                  <Check className="h-4 w-4 text-accent" />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
