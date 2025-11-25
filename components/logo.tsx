"use client"

import Image from "next/image"
import { APP_NAME } from "@/lib/app-config"

type LogoProps = {
  size?: number
}

export default function Logo({ size = 40 }: LogoProps) {
  return (
    <div className="relative flex items-center">
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <Image
          src="/icon.png"            // круг с руками
          alt={`${APP_NAME} logo`}
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority
        />
      </div>
    </div>
  )
}
