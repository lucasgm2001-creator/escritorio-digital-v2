'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Portal de overlay — relocaliza os `children` para FILHO DIRETO do <body> (contexto de empilhamento
 * RAIZ). Resolve de raiz o bug de overlays full-screen (fixed inset-0) renderizados INLINE na área de
 * conteúdo: no layout (flex column: conteúdo flex-1 + BottomNav shrink-0), o BottomNav é IRMÃO que pinta
 * DEPOIS e, no mobile, um ancestral cria contexto de empilhamento (toque @media (pointer:coarse) / iOS
 * tratando position:fixed dentro de container que rola) que PRENDE o z do overlay → o BottomNav (e o
 * ícone verde ativo) vazam por cima. Portado pro body, o overlay fica acima de tudo.
 *
 * Uso: <Portal><div className="fixed inset-0 z-[300] ...">…overlay…</div></Portal>
 *  - mantenha o z do overlay em z-[300] (acima do FAB/toast z-[200] e dos players z-[100]/[110]).
 *  - guard de SSR (Next): só porta no client (document não existe no server) — evita mismatch.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}
