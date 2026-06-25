// Configuração da "Visão Geral" do Hall — por usuário, em localStorage (sem migration). Lida no
// CLIENT (useEffect) p/ não dar hydration mismatch. O Hall lê isto p/ mostrar/esconder blocos e
// métricas e ligar/desligar leads/clientes/fusos no mapa. Configurações > Andares > Hall escreve.

export interface HallSettings {
  // Blocos da Visão Geral. (O Mapa agora é uma ABA própria do Hall, não um bloco daqui.)
  blocks: { agenda: boolean; tarefas: boolean; atividade: boolean; noticias: boolean }
  metrics: { clientesAtivos: boolean; leadsAbertos: boolean; leadsNovos: boolean; conversao: boolean }
  map: { leads: boolean; clients: boolean; fusos: boolean }
}

export const DEFAULT_HALL_SETTINGS: HallSettings = {
  blocks: { agenda: true, tarefas: true, atividade: true, noticias: true },
  metrics: { clientesAtivos: true, leadsAbertos: true, leadsNovos: true, conversao: true },
  map: { leads: true, clients: true, fusos: true },
}

export const HALL_SETTINGS_EVENT = 'ed-hall-settings'
const keyFor = (userId: string) => `ed-hall-settings:${userId || 'anon'}`

export function getHallSettings(userId: string): HallSettings {
  if (typeof window === 'undefined') return DEFAULT_HALL_SETTINGS
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return DEFAULT_HALL_SETTINGS
    const p = JSON.parse(raw) as Partial<HallSettings>
    return {
      blocks: { ...DEFAULT_HALL_SETTINGS.blocks, ...(p.blocks ?? {}) },
      metrics: { ...DEFAULT_HALL_SETTINGS.metrics, ...(p.metrics ?? {}) },
      map: { ...DEFAULT_HALL_SETTINGS.map, ...(p.map ?? {}) },
    }
  } catch { return DEFAULT_HALL_SETTINGS }
}

export function setHallSettings(userId: string, s: HallSettings) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(s))
    window.dispatchEvent(new Event(HALL_SETTINGS_EVENT))
  } catch { /* ignore */ }
}
