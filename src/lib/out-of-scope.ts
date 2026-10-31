import { toast } from 'sonner'
import { announce } from '@/components/live-region'

/**
 * Ações fora do escopo da entrega (editorial, suporte, atividade, ofertas,
 * downloads, login social, newsletter...). Nunca simulam sucesso: informam
 * claramente que a função não está disponível nesta demonstração.
 */
export function notAvailable(feature: string) {
  const msg = `${feature} não está disponível nesta demonstração.`
  toast.info(msg, { id: `oos-${feature}` })
  announce(msg)
}
