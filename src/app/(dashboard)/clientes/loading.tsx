// Skeleton Bento de Clientes — busca + grade de cards.
export default function ClientesLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div className="h-7 w-40 rounded bg-bento-border/40 animate-pulse" />
      <div className="h-10 w-full max-w-sm rounded-btn bg-bento-border/30 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 rounded-bento bg-bento-border/30 animate-pulse" />)}
      </div>
    </div>
  )
}
