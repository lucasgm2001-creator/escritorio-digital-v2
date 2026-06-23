'use client'

import { Component, type ReactNode } from 'react'

// Error boundary genérico: isola uma seção para que, se ela quebrar, o resto da tela continue.
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="bento-fx p-6 text-center">
            <p className="text-sm text-bento-muted">Não foi possível carregar esta seção. Recarregue a página.</p>
          </div>
        )
      )
    }
    return this.props.children
  }
}
