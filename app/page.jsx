"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DrivePickerButton from "@/components/DrivePickerButton";
import HeuristicsSelector from "@/components/HeuristicsSelector";
import HistorySidebar from "@/components/HistorySidebar";
import AppHeader from "@/components/AppHeader";
import LoginScreen from "@/components/LoginScreen";
import ResultCard from "@/components/ResultCard";
import { db } from "@/lib/db";
import { prepareFileForGemini } from "@/lib/gemini-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, FileVideo, FileImage, X, Plus } from "lucide-react";

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
  const [uploadStatus, setUploadStatus] = useState("");
  const [evaluations, setEvaluations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeEvaluation, setActiveEvaluation] = useState(null);

  const developerKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  // --------------- Session persistence ---------------

  const persistSession = useCallback(async (token) => {
    setAccessToken(token);
    sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
    const userInfo = await fetchUserInfo(token);
    if (userInfo) {
      setUser(userInfo);
      sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userInfo));
    }
  }, []);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(STORAGE_TOKEN_KEY);
    if (!savedToken) return;

    fetchUserInfo(savedToken).then((info) => {
      if (info) {
        setAccessToken(savedToken);
        const savedUser = sessionStorage.getItem(STORAGE_USER_KEY);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            setUser(info);
          }
        } else {
          setUser(info);
        }
      } else {
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_USER_KEY);
      }
    });
  }, []);

  // --------------- Google Identity Services ---------------

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

  // --------------- Load heuristics & evaluations ---------------

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

  // --------------- Handlers ---------------

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

  const removeFile = (fileId) => {
    setPickedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // --------------- Main analysis flow (client-side upload) ---------------

  const handleAnalyze = async () => {
    if (
      !accessToken ||
      selectedHeuristics.length === 0 ||
      pickedFiles.length === 0
    ) {
      return;
    }

    if (!geminiApiKey) {
      setUploadStatus("Erro: NEXT_PUBLIC_GEMINI_API_KEY não configurada.");
      return;
    }

    setLoading(true);
    setUploadStatus("");

    try {
      const heuristicsPayload = buildHeuristicsPayload(
        heuristicsGroups,
        selectedHeuristics
      );

      // 1. Upload all files to Gemini Files API client-side
      const mediaParts = [];
      for (let i = 0; i < pickedFiles.length; i++) {
        const file = pickedFiles[i];
        setUploadStatus(
          `[${i + 1}/${pickedFiles.length}] Preparando "${file.name}"…`
        );
        const part = await prepareFileForGemini(
          accessToken,
          geminiApiKey,
          file,
          (status) =>
            setUploadStatus(`[${i + 1}/${pickedFiles.length}] ${status}`)
        );
        mediaParts.push(part);
      }

      // 2. Send only fileUri refs + heuristics to server
      setUploadStatus("Gerando avaliação com Gemini…");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heuristics: heuristicsPayload,
          mediaParts,
          context: analysisContext
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Falha ao analisar.");
      }

      // 3. Save to IndexedDB
      const record = {
        createdAt: new Date().toLocaleString("pt-BR"),
        title: `Avaliação ${new Date().toLocaleTimeString("pt-BR")}`,
        heuristics: heuristicsPayload,
        files: pickedFiles,
        results: data.results || [],
        usage: data.usage || null
      };
      const id = await db.evaluations.add(record);
      await loadEvaluations(id);
      setActiveEvaluation({ ...record, id });
      setActiveId(id);
      setUploadStatus("");
    } catch (error) {
      console.error(error);
      setUploadStatus(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --------------- Evaluation navigation ---------------

  const handleSelectEvaluation = async (id) => {
    const item = await db.evaluations.get(id);
    setActiveId(id);
    setActiveEvaluation(item || null);
  };

  const handleNewEvaluation = () => {
    setActiveId(null);
    setActiveEvaluation(null);
    setSelectedHeuristics([]);
    setPickedFiles([]);
    setAnalysisContext("");
  };

  // --------------- Derived state ---------------

  const canAnalyze =
    accessToken &&
    selectedHeuristics.length > 0 &&
    pickedFiles.length > 0 &&
    !loading;

  const activeHeuristics = useMemo(
    () => buildHeuristicsPayload(heuristicsGroups, selectedHeuristics),
    [heuristicsGroups, selectedHeuristics]
  );

  // --------------- Not logged in ---------------

  if (!accessToken) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // --------------- Logged in ---------------

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <HistorySidebar
        evaluations={evaluations}
        selectedId={activeId}
        onSelect={handleSelectEvaluation}
        onNew={handleNewEvaluation}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader user={user} onLogout={handleLogout} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">

            {/* ---- Step 1: Heuristics ---- */}
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="h-7 w-7 items-center justify-center rounded-full p-0 font-bold">
                  1
                </Badge>
                <h2 className="text-base font-semibold">
                  Select the heuristics you want to investigate
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                You can select one or more heuristics.
              </p>
              {heuristicsLoading ? (
                <p className="text-sm text-muted-foreground">Loading heuristics…</p>
              ) : (
                <HeuristicsSelector
                  groups={heuristicsGroups}
                  selected={selectedHeuristics}
                  onValueChange={setSelectedHeuristics}
                />
              )}
            </section>

            <Separator />

            {/* ---- Step 2: Evidences ---- */}
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="h-7 w-7 items-center justify-center rounded-full p-0 font-bold">
                  2
                </Badge>
                <h2 className="text-base font-semibold">
                  Select the evidences on Google Drive
                </h2>
              </div>

              <DrivePickerButton
                accessToken={accessToken}
                developerKey={developerKey}
                appId={appId}
                onPicked={(newFiles) =>
                  setPickedFiles((prev) => {
                    const existingIds = new Set(prev.map((f) => f.id));
                    const unique = newFiles.filter((f) => !existingIds.has(f.id));
                    return [...prev, ...unique];
                  })
                }
              />

              {pickedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pickedFiles.map((file) => (
                    <Badge key={file.id} variant="secondary" className="gap-1.5 py-1 pl-2 pr-1">
                      {file.mimeType?.startsWith("video/") ? (
                        <FileVideo className="h-3.5 w-3.5" />
                      ) : (
                        <FileImage className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-[180px] truncate text-xs">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* ---- Step 3: Context ---- */}
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="h-7 w-7 items-center justify-center rounded-full p-0 font-bold">
                  3
                </Badge>
                <h2 className="text-base font-semibold">Add a context <span className="text-muted-foreground">(optional)</span></h2>
              </div>
              <textarea
                value={analysisContext}
                onChange={(e) => setAnalysisContext(e.target.value)}
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Describe the scenario, target audience and goals…"
              />
            </section>

            <Separator />

            {/* ---- Actions ---- */}
            <section className="flex items-center gap-4">
              {loading ? (
                <Button disabled className="gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguarde a análise…
                </Button>
              ) : (
                <Button onClick={handleAnalyze} disabled={!canAnalyze} className="gap-2">
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              )}

              {uploadStatus && (
                <p className="text-sm text-amber-600 dark:text-amber-400 animate-pulse">
                  {uploadStatus}
                </p>
              )}
            </section>

            {/* ---- Results ---- */}
            {activeEvaluation?.results && activeEvaluation.results.length > 0 && (
              <>
                <Separator />
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Results</h2>
                    <Button variant="outline" size="sm" onClick={handleNewEvaluation} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Nova avaliação
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {activeEvaluation.results.map((result, index) => (
                      <ResultCard
                        key={result.heuristicNumber || index}
                        result={result}
                      />
                    ))}
                  </div>

                  {/* Token usage */}
                  {activeEvaluation.usage && (
                    <Card className="bg-muted/30">
                      <CardContent className="flex flex-wrap items-center gap-6 py-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Token Usage
                        </span>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">Prompt:</span>
                          <span className="font-mono font-semibold">
                            {activeEvaluation.usage.promptTokenCount?.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">Response:</span>
                          <span className="font-mono font-semibold">
                            {activeEvaluation.usage.candidatesTokenCount?.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-mono font-bold text-primary">
                            {activeEvaluation.usage.totalTokenCount?.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </section>
              </>
            )}

            {/* Legacy support: old evaluations with response text instead of results */}
            {activeEvaluation?.response && !activeEvaluation?.results && (
              <>
                <Separator />
                <section className="space-y-4">
                  <h2 className="text-xl font-bold">Results</h2>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="whitespace-pre-wrap text-sm">
                        {activeEvaluation.response}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
