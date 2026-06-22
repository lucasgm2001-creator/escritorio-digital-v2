import { ddmm } from '@/lib/format'

// Seletor de período compartilhado (mesma lógica do Relatório de Atividades).
export type Mode = 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'ano' | 'tudo'
export interface Range { mode: string; start: Date; end: Date; label: string }

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
// Semana começa na SEGUNDA.
const mondayOf = (d: Date) => { const x = startOfDay(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return x }

export function rangeFor(mode: Mode, now = new Date()): Range {
  if (mode === 'dia') return { mode, start: startOfDay(now), end: endOfDay(now), label: `Dia ${ddmm(now)}` }
  if (mode === 'semana') {
    const start = mondayOf(now)
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))
    return { mode, start, end, label: `Semana de ${ddmm(start)} a ${ddmm(end)}` }
  }
  if (mode === 'mes') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    return { mode, start, end, label: `${MONTHS[now.getMonth()]} de ${now.getFullYear()}` }
  }
  if (mode === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3)
    const start = startOfDay(new Date(now.getFullYear(), q * 3, 1))
    const end = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0))
    return { mode, start, end, label: `${q + 1}º trimestre de ${now.getFullYear()}` }
  }
  if (mode === 'tudo') {
    return { mode, start: new Date(2000, 0, 1), end: endOfDay(now), label: 'Tudo' }
  }
  if (mode === 'semestre') {
    const h1 = now.getMonth() < 6
    const start = startOfDay(new Date(now.getFullYear(), h1 ? 0 : 6, 1))
    const end = endOfDay(new Date(now.getFullYear(), h1 ? 6 : 12, 0))
    return { mode, start, end, label: `${h1 ? '1º' : '2º'} semestre de ${now.getFullYear()}` }
  }
  const start = startOfDay(new Date(now.getFullYear(), 0, 1))
  const end = endOfDay(new Date(now.getFullYear(), 11, 31))
  return { mode, start, end, label: `Ano de ${now.getFullYear()}` }
}

export const MODES: [Mode, string][] = [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano']]
