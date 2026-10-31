import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from './query-client'
import { router } from './router'
import { installSessionSync } from './session-sync'

export function mount(el: HTMLElement) {
  installSessionSync()
  createRoot(el).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
