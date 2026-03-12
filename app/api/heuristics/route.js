import fs from "fs/promises";
import path from "path";
import { groupHeuristics } from "@/lib/heuristics";

export const runtime = "nodejs";

async function loadConfig() {
  const filePath = path.join(process.cwd(), "config.json");
  const fileContent = await fs.readFile(filePath, "utf-8");
  return JSON.parse(fileContent);
}

async function loadHeuristicsFromFile() {
  const filePath = path.join(process.cwd(), "heuristics.json");
  const fileContent = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(fileContent);
  return parsed?.data?.heuristics || [];
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get("project");

    let heuristics = [];

    if (projectSlug) {
      const baseUrl = process.env.BASE_API_URL;
      const apiKey = process.env.API_KEY;

      const config = await loadConfig();
      const project = config.projects?.find((p) => p.slug === projectSlug);

      if (!project) {
        return Response.json(
          { error: `Projeto "${projectSlug}" não encontrado.` },
          { status: 404 }
        );
      }

      if (baseUrl && apiKey) {
        const url = `${baseUrl.replace(/\/$/, "")}${project.heuristics.startsWith("/") ? project.heuristics : `/${project.heuristics}`}`;
        const headers = {
          api_key: apiKey
        };

        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`API retornou ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        heuristics = data?.data?.heuristics || data?.heuristics || (Array.isArray(data) ? data : []);
      } else {
        heuristics = await loadHeuristicsFromFile();
      }
    } else {
      heuristics = await loadHeuristicsFromFile();
    }

    const groups = groupHeuristics(heuristics);
    return Response.json({ groups });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Erro ao carregar heurísticas." },
      { status: 500 }
    );
  }
}
