// Skeleton Bento do Hall — estrutura aparece na hora enquanto o server busca.
export default function HallLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-bento-border/40 animate-pulse" />
          <div className="h-4 w-32 rounded bg-bento-border/30 animate-pulse" />
        </div>
        <div className="h-8 w-24 rounded-full bg-bento-border/40 animate-pulse" />
      </div>
      <div className="h-9 w-40 rounded bg-bento-border/30 animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-bento bg-bento-border/30 animate-pulse" />
        <div className="h-24 rounded-bento bg-bento-border/30 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 rounded-bento bg-bento-border/30 animate-pulse" />
        <div className="h-64 rounded-bento bg-bento-border/30 animate-pulse" />
      </div>
    </div>
  )
}
