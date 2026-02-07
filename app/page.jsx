/* eslint-disable react/no-unknown-property */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DrivePickerButton from "@/components/DrivePickerButton";
import HeuristicsSelector from "@/components/HeuristicsSelector";
import HistorySidebar from "@/components/HistorySidebar";
import { db } from "@/lib/db";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

const STORAGE_TOKEN_KEY = "sherlock_access_token";
const STORAGE_USER_KEY = "sherlock_user";

async function fetchUserInfo(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

function buildHeuristicsPayload(groups, selectedIds) {
  const items = [];
  groups.forEach((group) => {
    group.items.forEach((item) => {
      if (selectedIds.includes(item.id)) {
        items.push({
          id: item.id,
          name: item.name,
          heuristicNumber: item.heuristicNumber,
          description: item.description,
          group: group.title
        });
      }
    });
  });
  return items;
}

export default function HomePage() {
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [selectedHeuristics, setSelectedHeuristics] = useState([]);
  const [heuristicsGroups, setHeuristicsGroups] = useState([]);
  const [heuristicsLoading, setHeuristicsLoading] = useState(true);
  const [pickedFiles, setPickedFiles] = useState([]);
  const [analysisContext, setAnalysisContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeEvaluation, setActiveEvaluation] = useState(null);

  const developerKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Persist token + user to sessionStorage
  const persistSession = useCallback(async (token) => {
    setAccessToken(token);
    sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
    const userInfo = await fetchUserInfo(token);
    if (userInfo) {
      setUser(userInfo);
      sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userInfo));
    }
  }, []);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem(STORAGE_TOKEN_KEY);
    if (!savedToken) return;

    fetchUserInfo(savedToken).then((info) => {
      if (info) {
        setAccessToken(savedToken);
        setUser(info);
        const savedUser = sessionStorage.getItem(STORAGE_USER_KEY);
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)); } catch { /* use fetched */ }
        }
      } else {
        // Token expirado — limpar
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_USER_KEY);
      }
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2 && !tokenClient) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SCOPE,
          callback: (tokenResponse) => {
            if (tokenResponse?.access_token) {
              persistSession(tokenResponse.access_token);
            }
          }
        });
        setTokenClient(client);
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [clientId, tokenClient, persistSession]);

  useEffect(() => {
    const load = async () => {
      setHeuristicsLoading(true);
      try {
        const response = await fetch("/api/heuristics");
        const data = await response.json();
        if (response.ok) {
          setHeuristicsGroups(data.groups || []);
        }
      } finally {
        setHeuristicsLoading(false);
      }
    };
    load();
  }, []);

  const loadEvaluations = useCallback(async (selected) => {
    const items = await db.evaluations.orderBy("id").reverse().toArray();
    setEvaluations(items);
    if (selected) {
      setActiveId(selected);
      setActiveEvaluation(items.find((item) => item.id === selected) || null);
    } else if (items.length > 0) {
      setActiveId(items[0].id);
      setActiveEvaluation(items[0]);
    }
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const handleLogin = () => {
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt: "" });
  };

  const handleLogout = () => {
    setAccessToken("");
    setUser(null);
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_USER_KEY);
    if (window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
  };

  const handleToggle = (id) => {
    setSelectedHeuristics((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAnalyze = async () => {
    if (!accessToken || selectedHeuristics.length === 0 || pickedFiles.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const heuristicsPayload = buildHeuristicsPayload(
        heuristicsGroups,
        selectedHeuristics
      );
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          heuristics: heuristicsPayload,
          files: pickedFiles,
          context: analysisContext
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Falha ao analisar.");
      }

      const record = {
        createdAt: new Date().toLocaleString("pt-BR"),
        title: `Avaliação ${new Date().toLocaleTimeString("pt-BR")}`,
        heuristics: heuristicsPayload,
        files: pickedFiles,
        response: data.text
      };
      const id = await db.evaluations.add(record);
      await loadEvaluations(id);
      setActiveEvaluation({ ...record, id });
      setActiveId(id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvaluation = async (id) => {
    const item = await db.evaluations.get(id);
    setActiveId(id);
    setActiveEvaluation(item || null);
  };

  const handleNewEvaluation = () => {
    setActiveId(null);
    setActiveEvaluation(null);
  };

  const canAnalyze =
    accessToken && selectedHeuristics.length > 0 && pickedFiles.length > 0 && !loading;

  const activeHeuristics = useMemo(
    () => buildHeuristicsPayload(heuristicsGroups, selectedHeuristics),
    [heuristicsGroups, selectedHeuristics]
  );

  return (
    <div className="flex min-h-screen">
      <HistorySidebar
        evaluations={evaluations}
        selectedId={activeId}
        onSelect={handleSelectEvaluation}
        onNew={handleNewEvaluation}
      />
      <main className="flex-1 px-8 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Avaliação Heurística UX</h1>
            <p className="text-sm text-slate-400">
              Selecione heurísticas, evidências do Drive e gere insights com Gemini.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {accessToken && user ? (
              <div className="flex items-center gap-3">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name || "User"}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full border border-slate-700"
                  />
                )}
                <span className="text-sm text-slate-200">{user.name || user.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold"
              >
                Login com Google Workspace
              </button>
            )}
            <DrivePickerButton
              accessToken={accessToken}
              developerKey={developerKey}
              appId={appId}
              onPicked={setPickedFiles}
            />
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-panel/50 p-5">
              <h2 className="text-lg font-semibold">Heurísticas Selecionadas</h2>
              <p className="text-xs text-slate-400">
                Selecione uma ou mais heurísticas para orientar a análise.
              </p>
              <div className="mt-4">
                {heuristicsLoading ? (
                  <p className="text-xs text-slate-400">Carregando heurísticas...</p>
                ) : (
                  <HeuristicsSelector
                    groups={heuristicsGroups}
                    selected={selectedHeuristics}
                    onToggle={handleToggle}
                  />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-panel/50 p-5">
              <h2 className="text-lg font-semibold">Contexto adicional</h2>
              <p className="text-xs text-slate-400">
                Forneça detalhes sobre o fluxo ou objetivo do produto.
              </p>
              <textarea
                value={analysisContext}
                onChange={(event) => setAnalysisContext(event.target.value)}
                className="mt-3 min-h-[120px] w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Descreva o cenário, público-alvo e objetivos..."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-panel/50 p-5">
              <h2 className="text-lg font-semibold">Evidências do Drive</h2>
              <p className="text-xs text-slate-400">
                Selecionados: {pickedFiles.length}
              </p>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {pickedFiles.length === 0 ? (
                  <li>Nenhum arquivo selecionado.</li>
                ) : (
                  pickedFiles.map((file) => (
                    <li key={file.id} className="rounded-md border border-slate-800 p-2">
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-slate-400">{file.mimeType}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-panel/50 p-5">
              <h2 className="text-lg font-semibold">Resumo da análise</h2>
              <div className="mt-3 space-y-2 text-xs text-slate-400">
                <p>Heurísticas: {activeHeuristics.length}</p>
                <p>Arquivos: {pickedFiles.length}</p>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analisando..." : "Gerar Avaliação"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-800 bg-panel/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Resposta Gemini</h2>
            {activeEvaluation?.response && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(activeEvaluation.response)}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              >
                Copiar Resposta
              </button>
            )}
          </div>
          <div className="mt-4 whitespace-pre-wrap text-sm text-slate-200">
            {activeEvaluation?.response ? (
              activeEvaluation.response
            ) : (
              <p className="text-slate-400">
                Nenhuma avaliação selecionada. Gere uma nova para ver a resposta.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
