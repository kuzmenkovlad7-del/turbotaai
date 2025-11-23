"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export interface Testimonial {
  text: string
  image: string
  name: string
  role: string
}

interface TestimonialsColumnProps {
  testimonials: Testimonial[]
  className?: string
  duration?: number
}

export function TestimonialsColumn({
  testimonials,
  className,
  duration = 18,
}: TestimonialsColumnProps) {
  return (
    <div className={cn("w-64 sm:w-72", className)}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {testimonials.map(({ text, image, name, role }, i) => (
                <article
                  key={`${name}-${i}`}
                  className="w-full max-w-xs rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm shadow-indigo-100/60"
                >
                  <p className="text-sm leading-relaxed text-slate-700">
                    {text}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <img
                      width={40}
                      height={40}
                      src={image}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="flex flex-col">
                      <div className="text-sm font-semibold text-slate-900">
                        {name}
                      </div>
                      <div className="text-xs text-slate-500">{role}</div>
                    </div>
                  </div>
                </article>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  )
}
