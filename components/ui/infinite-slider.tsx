import * as React from "react"
import { cn } from "@/lib/utils"

export type InfiniteSliderProps = React.HTMLAttributes<HTMLDivElement> & {
  pauseOnHover?: boolean
  duration?: number
}

export function InfiniteSlider({
  className,
  children,
  pauseOnHover,
  duration,
  ...props
}: InfiniteSliderProps) {
  // Простейший контейнер, без сложной анимации, зато ничего не ломает.
  return (
    <div
      className={cn(
        "relative flex overflow-hidden whitespace-nowrap",
        pauseOnHover && "hover:[animation-play-state:paused]",
        className,
      )}
      {...props}
    >
      <div className="flex gap-8">
        {children}
      </div>
    </div>
  )
}
