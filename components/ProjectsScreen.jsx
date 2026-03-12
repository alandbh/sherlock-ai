"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FolderOpen, Loader2 } from "lucide-react";

export default function ProjectsScreen({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar projetos");
        setProjects(data.projects || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <AppHeader user={user} onLogout={onLogout} />

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Image
              src="/logo-sherlock.svg"
              alt="Sherlock"
              width={80}
              height={93}
            />
            <div>
              <h1 className="text-2xl font-bold">Selecione um projeto</h1>
              <p className="mt-1 text-muted-foreground">
                Escolha o projeto para iniciar a avaliação heurística
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
              {error}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Nenhum projeto configurado.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.slug} href={`/${project.slug}`}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FolderOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-semibold truncate">{project.name}</h2>
                          <p className="text-sm text-muted-foreground">
                            Edição {project.edition} · {project.year}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                        Abrir análise →
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
