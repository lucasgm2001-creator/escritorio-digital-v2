import { US_STATES } from '@/lib/usStates'
import usMap from '@/data/us-map.json'

// Funções PURAS + listas de chaves de parsing de formulário → lead. Cópia EXATA da lógica do
// /api/leads/inbound (comportamento idêntico) p/ ser reaproveitada pelo /api/leads/enrich. O inbound segue
// com a sua própria cópia inline (intocado); este módulo já está pronto p/ ele importar quando quiser.

export const AREA_CODES = (usMap as { areaCodes: Record<string, { st: string; city: string }> }).areaCodes
const US_CODE = new Set(US_STATES.map(s => s.code))
const US_NAME_TO_CODE = new Map(US_STATES.map(s => [s.name.toLowerCase(), s.code]))

export const str = (v: unknown): string => (v == null ? '' : String(v).trim())

// Achata TODOS os pares chave→valor do payload (incl. aninhados em customData/customFields/custom_fields)
// num mapa case-insensitive. 1ª ocorrência não-vazia vence.
export function flattenCI(body: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>()
  const eat = (obj: unknown) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) { eat(v); continue }
      const key = k.toLowerCase(); const val = str(v)
      if (val && !out.has(key)) out.set(key, val)
    }
  }
  eat(body)
  return out
}

// 1º valor não-vazio entre as chaves pedidas (case-insensitive).
export function pick(map: Map<string, string>, keys: string[]): string {
  for (const k of keys) { const v = map.get(k.toLowerCase()); if (v) return v }
  return ''
}

// "NC" | "north carolina" → "NC"; lixo / estado BRASILEIRO (MG, GO…) → '' (não é estado US).
export function normalizeUsState(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const up = s.toUpperCase()
  if (up.length === 2 && US_CODE.has(up)) return up
  return US_NAME_TO_CODE.get(s.toLowerCase()) ?? ''
}

// DDD a partir do telefone US (+1). 11+ díg. começando com 1 → [1..3]; 10 díg. → [0..2].
export function areaCodeFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11 && digits[0] === '1') return digits.slice(1, 4)
  if (digits.length === 10) return digits.slice(0, 3)
  return ''
}

// Valor/orçamento: aceita US ("1,234.56") E BR ("1.234,56"). O ÚLTIMO separador é o decimal. Sem número → 0.
export function parseValue(raw: string): number {
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return 0
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')   // vírgula decimal (BR)
  else s = s.replace(/,/g, '')                                          // ponto decimal (US)
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Heurística: parece ENDEREÇO (não nome de empresa)? CEP US ou logradouro → sim.
export function looksLikeAddress(s: string): boolean {
  if (/\b\d{5}(?:-\d{4})?\b/.test(s)) return true
  return /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|way|lane|ln|court|ct|hwy)\b/i.test(s)
}

// ── Listas de chaves (case-insensitive) — MESMAS do /api/leads/inbound ──
export const NICHO_KEYS = ['nicho', 'service', 'servico', 'serviço', 'tipo_de_negocio', 'tipo de negócio', 'business_type', 'niche', 'segmento', 'segment', 'tipo']
export const COMPANY_KEYS = ['company_name', 'company', 'empresa', 'business_name', 'business', 'nome_da_empresa', 'nome da empresa', 'negocio', 'negócio', 'razao_social']
export const VALUE_KEYS = ['value', 'valor', 'orcamento', 'orçamento', 'budget', 'investimento', 'faturamento', 'revenue']
export const NOTES_KEYS = ['message', 'mensagem', 'observacao', 'observação', 'obs', 'comentario', 'comentário', 'comments', 'duvida', 'dúvida', 'nota']
export const STATE_KEYS = ['state', 'estado', 'uf']
export const CITY_KEYS = ['city', 'cidade', 'municipio', 'município']
