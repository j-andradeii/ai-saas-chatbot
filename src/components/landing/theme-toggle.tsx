'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Stateless by design. The icons are swapped by the `dark:` variant rather than
 * by React state, so server and client markup always agree — no mount guard, no
 * hydration mismatch, and no setState-in-effect. The active theme is read from
 * the document at click time, which is always accurate whatever `defaultTheme`
 * resolved to.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle colour theme"
      onClick={() =>
        setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
      }
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  )
}
