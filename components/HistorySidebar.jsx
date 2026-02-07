export default function HistorySidebar({
  evaluations,
  selectedId,
  onSelect,
  onNew
}) {
  return (
    <aside className="w-72 border-r border-slate-800 bg-panel/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-slate-300">Histórico</h2>
        <button
          type="button"
          onClick={onNew}
          className="rounded-md bg-accent px-3 py-1 text-xs font-semibold"
        >
          Nova
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {evaluations.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma avaliação ainda.</p>
        ) : (
          evaluations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                selectedId === item.id
                  ? "border-accent bg-accent/20"
                  : "border-slate-800 hover:border-slate-600"
              }`}
            >
              <p className="font-medium text-slate-200">{item.title}</p>
              <p className="text-xs text-slate-400">{item.createdAt}</p>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
