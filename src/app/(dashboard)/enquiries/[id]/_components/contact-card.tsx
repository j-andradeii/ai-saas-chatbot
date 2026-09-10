import { Building2, Mail, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

function pickByKey(data: Record<string, unknown>, re: RegExp): string | null {
  for (const [key, value] of Object.entries(data)) {
    if (re.test(key) && value != null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return null
}

function pickEmail(data: Record<string, unknown>): string | null {
  const byKey = pickByKey(data, /e-?mail/i)
  if (byKey) return byKey
  for (const value of Object.values(data)) {
    const match = String(value ?? '').match(/[^\s@]+@[^\s@]+\.[^\s@]+/)
    if (match) return match[0]
  }
  return null
}

function pickName(data: Record<string, unknown>): string | null {
  return (
    pickByKey(data, /^name$|full.?name|your.?name|contact.?name/i) ??
    pickByKey(data, /name/i)
  )
}

/**
 * Surfaces the lead's contact details from the free-form submitted data so the
 * owner can reach out in one click. Renders nothing when none are detected.
 */
export function ContactCard({ data }: { data: Record<string, unknown> }) {
  const name = pickName(data)
  const email = pickEmail(data)
  const phone = pickByKey(data, /phone|mobile|tel|contact.?number/i)
  const company = pickByKey(data, /company|organi[sz]ation|business/i)

  if (!name && !email && !phone && !company) return null

  const initial = (name ?? email ?? '?').charAt(0).toUpperCase()

  return (
    <Card>
      <CardContent className="flex items-start gap-4 py-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {name && <p className="text-lg leading-tight font-semibold">{name}</p>}
          {company && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {company}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                {email}
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
