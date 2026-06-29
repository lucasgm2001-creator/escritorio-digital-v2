'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronUp, ChevronDown, ChevronRight, GripVertical, Plus, Lock, Trash2, X, Pencil, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { isStageProtected, stageRole, type FunnelStage, type StageRole } from '@/lib/funnelStages'
import { cn } from '@/lib/utils'

const NO_GROUP = 'Sem grupo'
// Paleta FIXA das fases (rótulo + hex gravado em `cor`). É a cor PRÓPRIA da fase (não o rotting).
// Inclui teal (#14B8A6 = Interagiu) e rosa (#EC4899 = Não Interagiu) + espectro completo. Trocar a
// paleta NÃO altera a cor já gravada em nenhuma fase — só amplia as opções clicáveis.
const PALETTE: { hex: string; label: string }[] = [
  { hex: '#EF4444', label: 'Vermelho' },
  { hex: '#F97316', label: 'Laranja' },
  { hex: '#F59E0B', label: 'Âmbar' },
  { hex: '#FACC15', label: 'Amarelo' },
  { hex: '#C2F73A', label: 'Lima' },
  { hex: '#84CC16', label: 'Verde-lima' },
  { hex: '#22C55E', label: 'Verde' },
  { hex: '#10B981', label: 'Esmeralda' },
  { hex: '#14B8A6', label: 'Teal (Interagiu)' },
  { hex: '#06B6D4', label: 'Ciano' },
  { hex: '#38BDF8', label: 'Azul celeste' },
  { hex: '#3B82F6', label: 'Azul' },
  { hex: '#6366F1', label: 'Índigo' },
  { hex: '#8B5CF6', label: 'Violeta' },
  { hex: '#A855F7', label: 'Roxo' },
  { hex: '#D946EF', label: 'Magenta' },
  { hex: '#EC4899', label: 'Rosa (Não Interagiu)' },
  { hex: '#F43F5E', label: 'Carmim' },
  { hex: '#64748B', label: 'Ardósia' },
  { hex: '#475569', label: 'Chumbo' },
]
const ROLE_LABEL: Record<StageRole, string> = { ganho: 'Ganho', perdido: 'Perdido', arquivo: 'Arquivo', ativo: 'Ativo' }
const ROLE_CLS: Record<StageRole, string> = {
  ganho: 'text-green-400 border-green-800/50', perdido: 'text-red-400 border-red-800/50',
  arquivo: 'text-bento-muted border-bento-border', ativo: 'text-lime-fg border-lime/40',
}

// nome → slug estável (sem acento/espaço). O slug NUNCA muda no renomear → nenhum lead muda de fase.
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Agrupa as fases por `grupo` (null → "Sem grupo"), grupos por MENOR posição, fases por posicao.
function buildGroups(stages: FunnelStage[]): { name: string; items: FunnelStage[] }[] {
  const map = new Map<string, FunnelStage[]>()
  for (const s of [...stages].sort((a, b) => a.posicao - b.posicao)) {
    const g = (s.grupo && s.grupo.trim()) || NO_GROUP
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(s)
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
}

// Editor PROFISSIONAL do funil. SÓ escreve: nome, cor, grupo, posicao, dias_esfriamento,
// conta_interagiu, arquivada — e cria/exclui conforme regras. NUNCA escreve slug/is_won/is_lost/
// is_system/conta_reuniao/conta_fechou em fase existente (DINHEIRO intocado). stage_events intocado.
export function FasesTab() {
  const supabase = createClient()
  const { toast } = useToast()
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selSlug, setSelSlug] = useState<string | null>(null)
  const [emptyGroups, setEmptyGroups] = useState<string[]>([])           // grupos criados ainda SEM fase (locais)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)  // grupo em renome inline
  const [renameDraft, setRenameDraft] = useState('')
  const [delState, setDelState] = useState<{ stage: FunnelStage; dest: string } | null>(null)
  const delDialog = useDialog<HTMLDivElement>(() => setDelState(null), !!delState)

  const load = useCallback(async () => {
    const { data } = await supabase.from('funnel_stages').select('*').order('posicao')
    setStages((data ?? []) as FunnelStage[])
    setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load])

  // Grupos exibidos = derivados das fases + grupos vazios criados agora (que ainda não têm fase).
  const displayGroups = useMemo(() => {
    const derived = buildGroups(stages)
    const have = new Set(derived.map(g => g.name))
    const empties = emptyGroups.filter(n => !have.has(n)).map(n => ({ name: n, items: [] as FunnelStage[] }))
    return [...derived, ...empties]
  }, [stages, emptyGroups])
  const groupNames = useMemo(() => displayGroups.map(g => g.name), [displayGroups])
  const sel = selSlug ? stages.find(s => s.slug === selSlug) ?? null : null
  const router = useRouter()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Persiste uma ordem PLANA (slug + grupo) → grava posicao (índice+1) e grupo só nas linhas que
  // mudaram. O diff é calculado DENTRO do setStages(prev) → 2 drags rápidos não gravam posicao errada.
  const persist = async (ordered: { slug: string; grupo: string | null }[]) => {
    let updates: { slug: string; posicao: number; grupo: string | null }[] = []
    setStages(prev => {
      updates = ordered.flatMap((o, i) => {
        const orig = prev.find(p => p.slug === o.slug); const pos = i + 1
        return orig && (orig.posicao !== pos || (orig.grupo ?? null) !== (o.grupo ?? null))
          ? [{ slug: o.slug, posicao: pos, grupo: o.grupo }] : []
      })
      return ordered.map((o, i) => ({ ...prev.find(p => p.slug === o.slug)!, posicao: i + 1, grupo: o.grupo }))
    })
    await Promise.all(updates.map(u => supabase.from('funnel_stages').update({ posicao: u.posicao, grupo: u.grupo }).eq('slug', u.slug)))
    router.refresh()   // Funil reflete reordenação/grupo sem refresh manual
  }

  // Arrastar fase: reordena dentro do grupo OU entra noutro grupo (soltando sobre um card de lá).
  // arrayMove (dnd-kit) calcula o índice destino certo — sem off-by-one ao remover antes de inserir.
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const flat = buildGroups(stages).flatMap(g => g.items.map(s => ({ slug: s.slug, grupo: g.name === NO_GROUP ? null : g.name })))
    const from = flat.findIndex(f => f.slug === active.id)
    const to = flat.findIndex(f => f.slug === over.id)
    if (from < 0 || to < 0) return
    const targetGroup = flat[to].grupo
    const moved = arrayMove(flat, from, to)
    const idx = moved.findIndex(f => f.slug === active.id)
    moved[idx] = { ...moved[idx], grupo: targetGroup }
    await persist(moved)
  }

  // Reordenar GRUPO (só entre grupos COM fases; grupos vazios ficam no fim, ordem local).
  const moveGroup = async (name: string, dir: -1 | 1) => {
    const gs = displayGroups; const idx = gs.findIndex(g => g.name === name); const j = idx + dir
    if (j < 0 || j >= gs.length || gs[idx].items.length === 0 || gs[j].items.length === 0) return
    const order = gs.map(g => g.name);[order[idx], order[j]] = [order[j], order[idx]]
    const byName = new Map(gs.map(g => [g.name, g.items]))
    await persist(order.flatMap(n => (byName.get(n) ?? []).map(s => ({ slug: s.slug, grupo: n === NO_GROUP ? null : n }))))
  }

  // "+ Novo grupo": cria grupo vazio NA HORA (local) com renome inline aberto.
  const newGroup = () => {
    const taken = new Set(groupNames); let name = 'Novo grupo'; let i = 2
    while (taken.has(name)) name = `Novo grupo ${i++}`
    setEmptyGroups(p => [...p, name]); setEditingGroup(name); setRenameDraft(name)
  }

  // Renomeia o grupo: COM fases → UPDATE funnel_stages SET grupo=novo WHERE grupo=antigo; vazio → local.
  const saveGroupName = async (oldName: string) => {
    const nn = renameDraft.trim()
    setEditingGroup(null)
    if (!nn || nn === oldName || oldName === NO_GROUP) return
    // Nome já existe → seria MERGE silencioso. Confirma antes (evita fundir A em B sem querer).
    if (groupNames.some(n => n !== oldName && n === nn) && !window.confirm(`Já existe um grupo "${nn}". Mesclar as fases de "${oldName}" nele?`)) return
    const hasStages = stages.some(s => ((s.grupo && s.grupo.trim()) || NO_GROUP) === oldName)
    if (hasStages) {
      setBusy(true)
      const { error } = await supabase.from('funnel_stages').update({ grupo: nn }).eq('grupo', oldName)
      setBusy(false)
      if (error) { toast({ type: 'error', message: `Não foi possível renomear: ${error.message}` }); return }
      setEmptyGroups(p => p.filter(n => n !== oldName)); load(); router.refresh()
    } else {
      setEmptyGroups(p => p.map(n => (n === oldName ? nn : n)))
    }
  }

  // "+ Adicionar fase aqui": cria fase NOVA neutra, JÁ FUNCIONAL. Entra na pipeline ATIVA, ANTES do bloco
  // terminal (ganho/perda/lixeira) — nunca depois da Lixeira. Slug único do nome (com tratamento da colisão
  // UNIQUE). Aparece na hora no funil/seletor porque tudo lê funnel_stages (data-driven).
  const addFaseToGroup = async (groupName: string) => {
    if (busy) return
    setBusy(true)
    try {
      const grupo = groupName === NO_GROUP ? null : groupName

      // POSIÇÃO: logo ANTES do bloco terminal. Terminal = won/lost/lixeira — NÃO use is_system sozinho
      // ('novo' é system e fica no começo). Sem terminais → vai pro fim. Abre espaço empurrando posicao>=alvo.
      const isTerminalEnd = (s: FunnelStage) => s.is_won || s.is_lost || s.slug === 'lixeira'
      const termPos = stages.filter(isTerminalEnd).map(s => s.posicao)
      const insertPos = termPos.length ? Math.min(...termPos) : Math.max(0, ...stages.map(s => s.posicao)) + 1
      const bump = stages.filter(s => s.posicao >= insertPos)
      if (bump.length) {
        const results = await Promise.all(bump.map(s => supabase.from('funnel_stages').update({ posicao: s.posicao + 1 }).eq('slug', s.slug)))
        const bErr = results.find(r => r.error)?.error
        if (bErr) { toast({ type: 'error', message: `Não foi possível abrir espaço pra fase: ${bErr.message}` }); return }
      }

      // SLUG único do NOME (placeholder 'Nova fase'): minúsculo/sem acento; colisão → sufixo _2,_3… Tratamos
      // TAMBÉM o erro UNIQUE do banco (corrida/estado velho): re-tenta com o próximo sufixo.
      const baseSlug = slugify('Nova fase') || 'fase'
      const used = new Set(stages.map(s => s.slug))
      let slug = baseSlug; let n = 2
      while (used.has(slug)) slug = `${baseSlug}_${n++}`

      const row = {
        nome: 'Nova fase', posicao: insertPos, grupo, dias_esfriamento: null, cor: null,
        is_won: false, is_lost: false, is_system: false, conta_interagiu: true, conta_reuniao: false, conta_fechou: false, arquivada: false,
      }
      let lastErr: { message: string } | null = null
      for (let attempt = 0; attempt < 8; attempt++) {
        const { error } = await supabase.from('funnel_stages').insert({ ...row, slug })
        if (!error) { lastErr = null; break }
        lastErr = error
        if (error.code === '23505') { slug = `${baseSlug}_${n++}`; continue }   // UNIQUE (slug) → próximo sufixo, tenta de novo
        break
      }
      if (lastErr) { toast({ type: 'error', message: `Não foi possível adicionar a fase: ${lastErr.message}` }); return }

      setEmptyGroups(p => p.filter(nm => nm !== groupName))
      setSelSlug(slug)
      await load(); router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Patch de colunas PERMITIDAS apenas (nunca flags de dinheiro).
  const patchStage = async (slug: string, patch: Partial<Pick<FunnelStage, 'nome' | 'cor' | 'dias_esfriamento' | 'conta_interagiu' | 'arquivada'>>) => {
    setStages(prev => prev.map(s => s.slug === slug ? { ...s, ...patch } : s))
    const { error } = await supabase.from('funnel_stages').update(patch).eq('slug', slug)
    if (error) { toast({ type: 'error', message: `Não foi possível salvar: ${error.message}` }); load() }
    else router.refresh()   // Funil reflete renomear/cor/arquivar sem refresh manual
  }

  // Mover fase p/ outro grupo (select do painel) — posicao no FIM (não bagunça a ordem).
  const moveToGroup = async (slug: string, groupName: string) => {
    const grupo = groupName === NO_GROUP ? null : groupName
    const posicao = Math.max(0, ...stages.map(s => s.posicao)) + 1
    setStages(prev => prev.map(s => s.slug === slug ? { ...s, grupo, posicao } : s))
    setEmptyGroups(p => p.filter(n => n !== groupName))
    await supabase.from('funnel_stages').update({ grupo, posicao }).eq('slug', slug)
    router.refresh()
  }

  // Excluir-mesclar: move os leads do slug antigo → destino ANTES de apagar. NÃO toca stage_events.
  const confirmDelete = async () => {
    if (!delState) return
    const { stage, dest } = delState
    if (isStageProtected(stage)) { toast({ type: 'error', message: 'Fase protegida não pode ser excluída.' }); return }
    if (!dest || dest === stage.slug) { toast({ type: 'error', message: 'Escolha a fase de destino dos leads.' }); return }
    setBusy(true)
    const { error: e1 } = await supabase.from('leads').update({ status: dest }).eq('status', stage.slug)
    if (e1) { setBusy(false); toast({ type: 'error', message: `Falha ao mover leads: ${e1.message}` }); return }
    const { error: e2 } = await supabase.from('funnel_stages').delete().eq('slug', stage.slug)
    setBusy(false)
    if (e2) { toast({ type: 'error', message: `Falha ao excluir: ${e2.message}` }); return }
    setDelState(null); setSelSlug(null); load(); router.refresh()
    toast({ type: 'success', message: 'Fase excluída e leads movidos.' })
  }

  return (
    <div className="space-y-4 max-w-2xl font-body">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-bento-text text-base">Fases do funil</h2>
          <p className="text-bento-muted text-xs mt-0.5">Crie grupos, adicione fases e arraste pra reordenar. Renomear muda só o rótulo — o identificador interno é preservado, então nenhum lead muda de fase. Protegidas (cadeado) não podem ser excluídas.</p>
        </div>
        <button onClick={newGroup} className="bento-btn flex items-center gap-1.5 px-3 py-2 rounded-btn text-xs font-semibold shrink-0 min-h-[40px]"><Plus className="w-4 h-4" />Novo grupo</button>
      </div>

      {loading ? (
        <p className="text-sm text-bento-muted">Carregando...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="space-y-3">
            {displayGroups.map((g, gi) => {
              const isClosed = collapsed.has(g.name)
              const editing = editingGroup === g.name
              // Setas só ativas entre grupos COM fases (igual o guard do moveGroup) → sem no-op enganoso.
              const canUp = g.items.length > 0 && displayGroups.slice(0, gi).some(x => x.items.length > 0)
              const canDown = g.items.length > 0 && displayGroups.slice(gi + 1).some(x => x.items.length > 0)
              return (
                <div key={g.name} className="bento-fx p-2">
                  {/* Cabeçalho do grupo: colapsar + nome(renome inline) + contagem + reordenar + adicionar fase */}
                  <div className="flex items-center gap-1.5 px-1.5 py-1">
                    <button onClick={() => setCollapsed(p => { const n = new Set(p); if (n.has(g.name)) n.delete(g.name); else n.add(g.name); return n })}
                      className="p-1 text-bento-muted hover:text-bento-text" aria-label="Colapsar grupo">
                      <ChevronRight className={cn('w-4 h-4 transition-transform', !isClosed && 'rotate-90')} />
                    </button>
                    {editing ? (
                      <input value={renameDraft} onChange={e => setRenameDraft(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveGroupName(g.name); if (e.key === 'Escape') setEditingGroup(null) }}
                        onBlur={() => saveGroupName(g.name)}
                        className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-2 py-1 text-xs text-bento-text focus:outline-none focus:border-lime" />
                    ) : (
                      <button onClick={() => { if (g.name !== NO_GROUP) { setEditingGroup(g.name); setRenameDraft(g.name) } }}
                        className="font-tech text-[11px] uppercase tracking-[0.12em] text-bento-dim flex-1 truncate text-left hover:text-bento-text">{g.name}</button>
                    )}
                    <span className="font-tech text-[10px] text-bento-muted tabular-nums">{g.items.length}</span>
                    {g.name !== NO_GROUP && !editing && (
                      <button onClick={() => { setEditingGroup(g.name); setRenameDraft(g.name) }} className="p-1 text-bento-muted hover:text-bento-text" aria-label="Renomear grupo" title="Renomear grupo"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                    {editing && <button onClick={() => saveGroupName(g.name)} className="p-1 text-lime-fg" aria-label="Salvar"><Check className="w-4 h-4" /></button>}
                    <button onClick={() => moveGroup(g.name, -1)} disabled={!canUp || busy} className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30" aria-label="Subir grupo"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveGroup(g.name, 1)} disabled={!canDown || busy} className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30" aria-label="Descer grupo"><ChevronDown className="w-4 h-4" /></button>
                  </div>

                  {!isClosed && (
                    <>
                      <SortableContext items={g.items.map(s => s.slug)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1.5 pt-1">
                          {g.items.map(s => (
                            <SortableFase key={s.slug} stage={s} selected={selSlug === s.slug} onSelect={setSelSlug} />
                          ))}
                        </div>
                      </SortableContext>
                      <button onClick={() => addFaseToGroup(g.name)} disabled={busy || editing}
                        title={editing ? 'Salve o nome do grupo primeiro' : undefined}
                        className="mt-1.5 w-full flex items-center justify-center gap-1.5 border border-dashed border-bento-border rounded-md py-2 text-xs text-bento-muted hover:border-lime hover:text-lime-fg transition-colors disabled:opacity-50">
                        <Plus className="w-3.5 h-3.5" />Adicionar fase aqui
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </DndContext>
      )}

      {/* Painel de edição da fase selecionada */}
      {sel && (
        <StagePanel
          key={sel.slug}
          stage={sel}
          groupNames={groupNames}
          onClose={() => setSelSlug(null)}
          onPatch={patchStage}
          onMoveGroup={moveToGroup}
          onArchive={(archived) => patchStage(sel.slug, { arquivada: archived })}
          onAskDelete={() => setDelState({ stage: sel, dest: '' })}
        />
      )}

      {/* Excluir-mesclar: escolher destino dos leads */}
      {delState && (
        <Portal>
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDelState(null)} />
          <div ref={delDialog.ref} {...delDialog.dialogProps} aria-labelledby="delstate-title" className="relative w-full max-w-sm bg-bento-panel border border-bento-border rounded-bento shadow-card-hover p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 id="delstate-title" className="font-display font-bold text-bento-text">Excluir “{delState.stage.nome}”</h3>
              <button onClick={() => setDelState(null)} aria-label="Fechar" className="p-1 text-bento-muted hover:text-bento-text"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-bento-muted">Os leads desta fase serão movidos para a fase escolhida ANTES de excluir (nenhum lead fica órfão). O histórico não é apagado.</p>
            <select value={delState.dest} onChange={e => setDelState(d => d && { ...d, dest: e.target.value })}
              className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime">
              <option value="">Mover leads para…</option>
              {stages.filter(s => s.slug !== delState.stage.slug).map(s => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDelState(null)} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors">Cancelar</button>
              <button onClick={confirmDelete} disabled={busy || !delState.dest} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-btn text-sm font-semibold disabled:opacity-50">Mover e excluir</button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      <p className="font-tech text-[11px] text-bento-muted/70">Mudanças aparecem no funil ao reabrir/atualizar a aba Comercial. Fases de venda/perda/sistema são protegidas (cadeado) e não afetam dinheiro por aqui.</p>
    </div>
  )
}

// ── Linha arrastável da fase (handle = grip; corpo seleciona p/ editar) ──
function SortableFase({ stage, selected, onSelect }: { stage: FunnelStage; selected: boolean; onSelect: (slug: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.slug })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const prot = isStageProtected(stage)
  const role = stageRole(stage)
  return (
    <div ref={setNodeRef} style={style} {...attributes} onClick={() => onSelect(stage.slug)}
      className={cn('flex items-center gap-2 bg-bento-bg border rounded-md p-2.5 cursor-pointer transition-colors', selected ? 'border-lime/60' : 'border-bento-border hover:border-lime/40')}>
      <button {...listeners} onClick={e => e.stopPropagation()} aria-label="Arrastar" className="cursor-grab touch-none text-bento-muted hover:text-bento-text shrink-0"><GripVertical className="w-4 h-4" /></button>
      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: stage.cor || '#64748b' }} />
      <span className="flex-1 text-sm text-bento-text truncate">{stage.nome}</span>
      {prot && <Lock className="w-3.5 h-3.5 text-bento-muted shrink-0" />}
      <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0', ROLE_CLS[role])}>{ROLE_LABEL[role]}</span>
    </div>
  )
}

// ── Painel de edição de UMA fase ──
function StagePanel({ stage, groupNames, onClose, onPatch, onMoveGroup, onArchive, onAskDelete }: {
  stage: FunnelStage
  groupNames: string[]
  onClose: () => void
  onPatch: (slug: string, patch: Partial<Pick<FunnelStage, 'nome' | 'cor' | 'dias_esfriamento' | 'conta_interagiu'>>) => void
  onMoveGroup: (slug: string, grupo: string) => void
  onArchive: (archived: boolean) => void
  onAskDelete: () => void
}) {
  const prot = isStageProtected(stage)
  const role = stageRole(stage)
  const [nome, setNome] = useState(stage.nome)
  const [dias, setDias] = useState(stage.dias_esfriamento != null ? String(stage.dias_esfriamento) : '')
  const curGroup = (stage.grupo && stage.grupo.trim()) || NO_GROUP
  const groupOptions = Array.from(new Set([NO_GROUP, ...groupNames, curGroup]))

  return (
    <div className="bento-fx p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-bento-text text-sm flex items-center gap-2">{prot && <Lock className="w-3.5 h-3.5 text-bento-muted" />}Editar fase</h3>
        <button onClick={onClose} aria-label="Fechar" className="p-1 text-bento-muted hover:text-bento-text"><X className="w-4 h-4" /></button>
      </div>

      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Nome</label>
        <input value={nome} onChange={e => setNome(e.target.value)} onBlur={() => nome.trim() && nome !== stage.nome && onPatch(stage.slug, { nome: nome.trim() })}
          className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
        <p className="font-tech text-[10px] text-bento-muted/70 mt-1">Identificador interno (slug): {stage.slug} — não muda no renomear.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Cor da fase</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PALETTE.map(c => (
            <button key={c.hex} onClick={() => onPatch(stage.slug, { cor: c.hex })} aria-label={c.label} title={c.label}
              className={cn('w-7 h-7 rounded-full border-2 transition-transform', stage.cor?.toUpperCase() === c.hex ? 'border-bento-text scale-110' : 'border-transparent hover:scale-105')}
              style={{ backgroundColor: c.hex }} />
          ))}
          <button onClick={() => onPatch(stage.slug, { cor: null })} className="text-[10px] text-bento-muted hover:text-bento-text px-1.5">limpar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Grupo</label>
          <select value={curGroup} onChange={e => e.target.value !== curGroup && onMoveGroup(stage.slug, e.target.value)}
            className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime">
            {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Esfria em (dias)</label>
          <input type="number" min="2" inputMode="numeric" value={dias} onChange={e => setDias(e.target.value)}
            onBlur={() => onPatch(stage.slug, { dias_esfriamento: dias.trim() === '' ? null : Math.max(2, Number(dias) || 5) })}
            placeholder="padrão (5)" className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
        </div>
      </div>

      {/* Papel — protegido = read-only (cadeado); comum = alterna Ativo/Arquivo (arquivada). */}
      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Papel</label>
        {prot ? (
          <div className="flex items-center gap-2 text-sm text-bento-muted"><Lock className="w-3.5 h-3.5" /><span className={cn('px-2 py-0.5 rounded-full border text-xs font-semibold', ROLE_CLS[role])}>{ROLE_LABEL[role]}</span><span className="text-[11px]">protegida (somente leitura)</span></div>
        ) : (
          <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 w-max">
            {([['ativo', 'Ativo'], ['arquivo', 'Arquivo']] as [StageRole, string][]).map(([v, l]) => (
              <button key={v} onClick={() => onArchive(v === 'arquivo')}
                className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors', role === v ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Conta como interação (conta_interagiu) — relatório, não comissão. */}
      <button onClick={() => onPatch(stage.slug, { conta_interagiu: !stage.conta_interagiu })}
        className="flex items-center justify-between w-full text-sm text-bento-text">
        <span>Conta como interação</span>
        <span className={cn('relative w-10 h-6 rounded-full transition-colors', stage.conta_interagiu ? 'bg-lime' : 'bg-bento-border')}>
          <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', stage.conta_interagiu && 'translate-x-4')} />
        </span>
      </button>

      {/* Excluir — só em fase NÃO protegida (obriga mover leads). */}
      {!prot && (
        <button onClick={onAskDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-3.5 h-3.5" />Excluir fase (move os leads)</button>
      )}
    </div>
  )
}
