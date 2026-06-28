'use client'
import { useEffect, useRef } from 'react'

// Comportamento padrão de DIÁLOGO acessível, reutilizável em todos os overlays (menos WonPlanModal, à parte):
//  • ESC fecha (só o diálogo do TOPO da pilha — modais aninhados não fecham todos juntos).
//  • Focus-trap: Tab / Shift+Tab circulam SÓ dentro do diálogo.
//  • Foco inicial no 1º focável (respeita autoFocus já aplicado) e RETORNA ao abridor ao fechar.
//  • Scroll-lock do body enquanto aberto (fundo não rola atrás no mobile) — M12.
// Uso (componente montado só quando aberto): const { ref, dialogProps } = useDialog(onClose)
// Uso (overlay INLINE condicional no pai): const d = useDialog(onClose, isOpen)  // enabled = quando aberto
//      <div ref={ref} {...dialogProps} aria-labelledby="id-do-titulo"> … </div>
// `enabled` (default true): quando false, o hook NÃO ativa nada (sem scroll-lock/listener) — assim dá pra
// chamá-lo incondicionalmente (regra de hooks) num pai que tem vários overlays inline, ativando só o aberto.

const SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Pilha de diálogos abertos (símbolos). Só o do topo responde a ESC/Tab → suporta modais aninhados.
const stack: symbol[] = []

export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void, enabled = true) {
  const ref = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!enabled) return
    const id = Symbol('dialog')
    stack.push(id)
    const isTop = () => stack[stack.length - 1] === id
    const opener = (document.activeElement as HTMLElement | null) ?? null

    // LER ref.current SEMPRE de forma LAZY. Os modais renderizam dentro de <Portal>, que monta os filhos
    // um tick DEPOIS (flag mounted) — capturar ref.current no mount do efeito pegava `null` e matava o
    // ESC/focus-trap (era o bug). Lendo na hora do keydown/rAF, o nó já existe.
    const focusables = (): HTMLElement[] => {
      const node = ref.current
      return node ? Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(el => el.getClientRects().length > 0) : []
    }

    // Scroll-lock do body (independe do nó já existir; preserva o valor anterior p/ modais aninhados).
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Foco inicial + tabindex assim que o nó existir (após o Portal montar). Não rouba de um autoFocus já dado.
    const raf = requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
      if (!node.contains(document.activeElement)) (focusables()[0] ?? node).focus?.()
    })

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      const node = ref.current
      if (!node) return
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) { e.preventDefault(); node.focus?.(); return }
      const first = f[0], last = f[f.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) { e.preventDefault(); last.focus() }
      } else {
        if (active === last || !node.contains(active)) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()   // retorna o foco a quem abriu
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { ref, dialogProps: { role: 'dialog' as const, 'aria-modal': true } }
}
