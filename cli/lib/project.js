import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = path.join(__dirname, "..", "projects");

/**
 * Resolve qual projeto usar, na ordem de prioridade:
 * 1. Flag --project passada explicitamente
 * 2. Arquivo .sherlock.json no diretório atual
 * 3. Projeto default (retail6)
 */
export async function resolveProject(projectFlag) {
  // 1. Flag explícita tem prioridade
  if (projectFlag) {
    return loadProject(projectFlag);
  }

  // 2. Tentar ler .sherlock.json no diretório atual
  try {
    const localConfig = JSON.parse(
      await fs.readFile(".sherlock.json", "utf-8")
    );
    if (localConfig.project) {
      return loadProject(localConfig.project);
    }
  } catch {
    // Não existe .sherlock.json, continua
  }

  // 3. Usar projeto default
  console.log(chalk.yellow("Nenhum projeto especificado, usando 'retail6'"));
  console.log(chalk.dim("Dica: use -p <projeto> ou execute 'sherlock init <projeto>'\n"));
  return loadProject("retail6");
}

/**
 * Carrega configuração e funções de um projeto específico
 */
export async function loadProject(name) {
  const projectPath = path.join(PROJECTS_DIR, name);

  // Verificar se o projeto existe
  try {
    await fs.access(projectPath);
  } catch {
    const available = await listProjectNames();
    throw new Error(
      `Projeto "${name}" não encontrado.\n` +
      `Projetos disponíveis: ${available.join(", ")}`
    );
  }

  return {
    name,
    path: projectPath,

    async loadHeuristics() {
      const filePath = path.join(projectPath, "heuristics.json");
      const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
      return data.data.heuristics;
    },

    async loadSystemPrompt() {
      const filePath = path.join(projectPath, "system_prompt.txt");
      return (await fs.readFile(filePath, "utf-8")).trim();
    }
  };
}

/**
 * Lista todos os projetos disponíveis com metadados
 */
export async function listProjects() {
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = path.join(PROJECTS_DIR, entry.name);

    // Carregar metadados (opcional)
    let meta = { description: "Sem descrição" };
    try {
      const metaPath = path.join(projectPath, "meta.json");
      meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
    } catch {
      // meta.json é opcional
    }

    // Contar heurísticas
    let heuristicsCount = 0;
    try {
      const heuristicsPath = path.join(projectPath, "heuristics.json");
      const data = JSON.parse(await fs.readFile(heuristicsPath, "utf-8"));
      heuristicsCount = data.data.heuristics.length;
    } catch {
      // heuristics.json não existe ou é inválido
    }

    projects.push({
      name: entry.name,
      description: meta.description,
      version: meta.version || "1.0",
      heuristicsCount
    });
  }

  return projects;
}

/**
 * Lista apenas os nomes dos projetos disponíveis
 */
async function listProjectNames() {
  const projects = await listProjects();
  return projects.map((p) => p.name);
}
