// Skeleton Bento de Tarefas — cabeçalho + lista.
export default function TarefasLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 rounded bg-bento-border/40 animate-pulse" />
        <div className="h-8 w-40 rounded-btn bg-bento-border/30 animate-pulse" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-bento bg-bento-border/30 animate-pulse" />)}
      </div>
    </div>
  )
}
