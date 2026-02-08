"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HistorySidebar({
  evaluations,
  selectedId,
  onSelect,
  onNew
}) {
  return (
    <aside className="flex w-64 flex-col border-r bg-muted/30 px-2">
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Image className="dark:invert" src="/logo-sherlock.svg" alt="Sherlock" width={32} height={37} />
          <span className="text-lg font-bold tracking-tight">Sherlock</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onNew} className="h-8 w-8">
          <Plus className="h-4 w-4" />
          <span className="sr-only">New analysis</span>
        </Button>
      </div>

      {/* Evaluation list */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2  w-64">
          <h2 className="text-sm font-semibold mt-6 mb-4">Previous analyses</h2>
          {evaluations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No previous analyses yet.
            </p>
          ) : (
            evaluations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedId === item.id
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.createdAt}</p>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
