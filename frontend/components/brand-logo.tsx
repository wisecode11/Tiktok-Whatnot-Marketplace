"use client"

import Image from "next/image"
import Link from "next/link"

import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  href?: string
  text?: string
  showText?: boolean
  className?: string
  imageClassName?: string
  /** @deprecated Use imageClassName */
  iconClassName?: string
  textClassName?: string
}

export function BrandLogo({
  href,
  text = BRAND_NAME,
  showText = false,
  className,
  imageClassName,
  iconClassName,
  textClassName,
}: BrandLogoProps) {
  const content = (
    <>
      <Image
        src={BRAND_LOGO_SRC}
        alt={`${BRAND_NAME} logo`}
        width={220}
        height={64}
        priority
        className={cn("h-10 w-auto max-w-[200px] object-contain object-left", imageClassName, iconClassName)}
      />
      {showText ? (
        <span className={cn("text-lg font-semibold tracking-tight text-foreground", textClassName)}>
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
