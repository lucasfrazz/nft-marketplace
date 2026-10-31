import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** Estilo dos campos do layout (borda marrom, fundo escuro, 40px). */
export const fieldClass =
  'h-10 rounded-[3px] border-line-strong bg-transparent px-3 text-[15px] text-cream placeholder:text-sand-2 focus-visible:border-copper focus-visible:ring-2 focus-visible:ring-copper/40 aria-invalid:border-coral aria-invalid:ring-coral/30 md:text-[15px] dark:bg-transparent'

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-coral">
      {message}
    </p>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: (a11y: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => ReactNode
  hideLabel?: boolean
}

export function Field({ label, required, error, hint, className, children, hideLabel }: FieldProps) {
  const id = useId()
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <Label htmlFor={id} className={cn('mb-2 text-[15px] font-normal text-cream', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden className="text-lg leading-none text-coral">
            *
          </span>
        )}
      </Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-sand-2">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} message={error} />
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function TextInput({ className, ...props }, ref) {
  return <Input ref={ref} className={cn(fieldClass, className)} {...props} />
})

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className={cn(fieldClass, 'pr-11', className)} {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded text-sand-2 hover:text-copper" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}>
        {show ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
      </button>
    </div>
  )
})

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  a11y,
  className,
  testId,
}: {
  value?: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  a11y: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }
  className?: string
  testId?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger {...a11y} className={cn(fieldClass, 'w-full data-[size=default]:h-10 data-placeholder:text-sand-2', className)} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-line bg-surface">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Nome ENS: sufixo ".eth" fixo + nome. */
export const EnsInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function EnsInput({ className, ...props }, ref) {
  return (
    <div className="flex gap-2.5">
      <span className="flex h-10 shrink-0 items-center rounded-[3px] border border-line-strong px-3 text-[15px] text-cream" aria-hidden>
        .eth
      </span>
      <Input ref={ref} className={cn(fieldClass, className)} {...props} />
    </div>
  )
})
