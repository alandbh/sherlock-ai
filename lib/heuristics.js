export function groupHeuristics(heuristics = []) {
  const groups = new Map();
  heuristics.forEach((item) => {
    const title = item.group?.name || "Sem grupo";
    if (!groups.has(title)) {
      groups.set(title, []);
    }
    groups.get(title).push({
      id: item.id,
      name: item.name,
      heuristicNumber: item.heuristicNumber,
      description: item.description,
      group: title
    });
  });

  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    items
  }));
}
