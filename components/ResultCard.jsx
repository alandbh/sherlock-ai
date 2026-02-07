"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function scoreBadgeVariant(score) {
  if (score >= 4) return "success";
  if (score >= 3) return "warning";
  return "destructive";
}

function scoreLabel(score) {
  if (score === 5) return "Excelente";
  if (score === 4) return "Bom";
  if (score === 3) return "Regular";
  if (score === 2) return "Ruim";
  if (score === 1) return "Crítico";
  return "—";
}

export default function ResultCard({ result }) {
  const [copied, setCopied] = useState(false);

  // Fallback for raw/unstructured responses
  if (result.raw) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <p className="text-sm font-semibold">Resposta (formato livre)</p>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{result.raw}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    const text = [
      `Heurística: ${result.heuristicNumber} — ${result.name}`,
      result.rejected
        ? `Rejeitada: ${result.rejectionReason}`
        : `Pontuação: ${result.score}`,
      `Justificativa: ${result.justification}`
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn(result.rejected && "border-amber-300 dark:border-amber-700")}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {result.heuristicNumber}
            </Badge>
            <p className="text-sm font-semibold leading-snug">{result.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {result.rejected ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Rejeitada
            </Badge>
          ) : (
            <Badge variant={scoreBadgeVariant(result.score)} className="tabular-nums">
              {result.score}/5 — {scoreLabel(result.score)}
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {result.rejected ? (
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Evidência rejeitada</p>
            <p className="mt-1">{result.rejectionReason}</p>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            <ReactMarkdown>{result.justification}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
