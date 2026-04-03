"use client"

import Link from "next/link"
import { Zap } from "lucide-react"

import { BRAND_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  href?: string
  text?: string
  showText?: boolean
  className?: string
  iconClassName?: string
  textClassName?: string
}

export function BrandLogo({
  href,
  text = BRAND_NAME,
  showText = true,
  className,
  iconClassName,
  textClassName,
}: BrandLogoProps) {
  const content = (
    <>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-lg shadow-primary/20",
          iconClassName,
        )}
      >
        <Zap className="h-5 w-5" />
      </div>
      {showText ? (
        <span className={cn("text-lg font-semibold tracking-tight text-foreground")}>
          {text}
        </span>
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn("flex items-center gap-3", className)}>
        {content}
      </Link>
    )
  }

  return <div className={cn("flex items-center gap-3", className)}>{content}</div>
}