import * as React from 'react'
import { cn } from '@/lib/utils'
import { Slider as SliderPrimitive } from 'radix-ui'

/** shadcn/ui Slider adaptado ao layout Kurio (trilho cobre, polegares 16px) + rótulos por polegar. */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
  const _values = React.useMemo(() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]), [value, defaultValue, min, max])

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex w-full touch-none items-center select-none data-disabled:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-copper/40">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-copper" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels?.[index]}
          className="relative block size-4 shrink-0 rounded-full border-2 border-ink bg-copper ring-copper-bright/50 transition-[box-shadow] select-none after:absolute after:-inset-2 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
