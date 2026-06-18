// Skeleton Bento do Comercial — abas + caixas de fase do funil.
export default function ComercialLoading() {
  return (
    <div className="p-4 sm:p-5 space-y-4">
      <div className="flex gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-9 w-28 rounded-btn bg-bento-border/30 animate-pulse" />)}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-32 w-52 flex-none rounded-[10px] bg-bento-border/30 animate-pulse" />)}
      </div>
    </div>
  )
}
