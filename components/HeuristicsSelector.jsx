"use client";

import { useMemo } from "react";
import { MultiSelect } from "@/components/ui/multi-select";

/**
 * Transforms the heuristic groups from the API into flat options
 * for the MultiSelect component with group labels.
 */
function buildOptions(groups) {
  const options = [];
  groups.forEach((group) => {
    group.items.forEach((item) => {
      options.push({
        value: item.id,
        label: `${item.heuristicNumber} — ${item.name}`,
        group: group.title
      });
    });
  });
  return options;
}

export default function HeuristicsSelector({ groups, selected, onValueChange }) {
  const options = useMemo(() => buildOptions(groups), [groups]);

  return (
    <MultiSelect
      options={options}
      onValueChange={onValueChange}
      defaultValue={selected}
      placeholder="Select the heuristics you want to investigate"
      maxCount={3}
    />
  );
}
