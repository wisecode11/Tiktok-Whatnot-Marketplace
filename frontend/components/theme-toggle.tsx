'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className={cn(
          'h-10 w-20 rounded-full border border-border/70 bg-card/80 shadow-sm',
          className,
        )}
      />
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'h-10 rounded-full border-border/70 bg-card/85 px-3 text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70',
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Sun className="h-4 w-4 text-amber-500" />
      <div className="relative h-5 w-8 rounded-full bg-muted">
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-primary transition-transform',
            isDark ? 'left-3.5' : 'left-0.5',
          )}
        />
      </div>
      <Moon className="h-4 w-4 text-indigo-500" />
    </Button>
  )
}