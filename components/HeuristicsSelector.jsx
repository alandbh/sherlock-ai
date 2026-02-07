export default function HeuristicsSelector({ groups, selected, onToggle }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-semibold text-slate-200">{group.title}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {group.items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 hover:border-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 h-4 w-4 accent-violet-500"
                />
                <span>
                  <p className="text-sm font-medium text-slate-100">
                    {item.heuristicNumber} - {item.name}
                  </p>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
