import { cn } from '@/lib/utils'

const WIDTHS = [160, 320, 640, 960] as const

/** Imagem responsiva (WebP) das artes exportadas do Figma. */
export function NftImage({
  art,
  alt,
  sizes = '(max-width: 640px) 50vw, 300px',
  className,
  priority = false,
  width = 640,
}: {
  art: string
  alt: string
  sizes?: string
  className?: string
  priority?: boolean
  width?: (typeof WIDTHS)[number]
}) {
  const base = `${import.meta.env.BASE_URL}images/nfts/${art}`
  return (
    <img
      src={`${base}-${width}.webp`}
      srcSet={WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      width={width}
      height={width}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      className={cn('aspect-square h-auto w-full object-cover', className)}
    />
  )
}
