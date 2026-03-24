#!/usr/bin/env node

import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Carregar .env da pasta cli/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "..", ".env") });

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs/promises";

import { uploadLocalFile } from "../lib/upload.js";
import { analyzeWithGemini } from "../lib/analyze.js";
import { resolveProject, listProjects } from "../lib/project.js";

program
  .name("sherlock")
  .description("Análise heurística de UX com IA")
  .version("1.0.0", "-v, --version")
  .option("-p, --project <nome>", "Nome do projeto (retail6, finance5, etc)")
  .option("-o, --output <arquivo>", "Salvar resultado (txt, json, ou nome.ext)")
  .option("-c, --context <texto>", "Contexto adicional");

program
  .argument("<video>", "Caminho do vídeo ou imagem (vários: v1.mp4,v2.mp4)")
  .argument("<heuristicas>", "Números das heurísticas (ex: 3.16 ou 3.16,3.17)")
  .option("-j, --journey <slug>", "Jornada da heurística (obrigatório em projetos Finance; ex: abertura, app)")
  .action(async (video, heuristicasArg, options) => {
    const spinner = ora();
    const opts = { ...program.opts(), ...options };

    try {
      // 1. Resolver projeto
      const project = await resolveProject(opts.project);
      console.log(chalk.dim(`\nUsando projeto: ${chalk.cyan(project.name)}\n`));

      // 2. Resolver arquivo(s) (suporta nome parcial e múltiplos: v1,v2)
      const videoPaths = await resolveFiles(video);
      if (!videoPaths || videoPaths.length === 0) {
        process.exit(1);
      }

      const mediaParts = [];
      for (const p of videoPaths) {
        mediaParts.push({ path: p, mimeType: getMimeType(p) });
      }
      const fileNames = videoPaths.map((p) => path.basename(p));

      // 3. Carregar heurísticas do projeto
      spinner.start("Carregando heurísticas...");
      const allHeuristics = await project.loadHeuristics();
      const numeros = heuristicasArg.split(",").map((n) => n.trim());
      let selected;
      try {
        selected = filterByNumberAndJourney(allHeuristics, numeros, opts.journey, project.meta);
      } catch (err) {
        spinner.fail(chalk.red(err.message));
        process.exit(1);
      }

      if (selected.length === 0) {
        spinner.fail(chalk.red(`Nenhuma heurística encontrada: ${heuristicasArg}`));
        console.log(chalk.dim("\nHeurísticas disponíveis:"));
        const available = allHeuristics.map((h) => h.heuristicNumber).sort();
        console.log(chalk.dim(available.join(", ")));
        if (project.meta?.requiresJourney) {
          const journeys = getUniqueJourneySlugs(allHeuristics);
          console.log(chalk.dim(`Jornadas: ${journeys.join(", ")}`));
        }
        process.exit(1);
      }
      spinner.succeed(`${selected.length} heurística(s) selecionada(s): ${numeros.join(", ")}`);

      // 4. Upload para Gemini
      spinner.start(`Enviando ${chalk.cyan(fileNames.join(", "))} para o Gemini...`);
      const uploadedMedia = [];
      for (const mp of mediaParts) {
        const { fileUri } = await uploadLocalFile(mp.path, mp.mimeType);
        uploadedMedia.push({ fileUri, mimeType: mp.mimeType });
      }
      spinner.succeed(`Upload concluído: ${fileNames.join(", ")}`);

      // 5. Carregar system prompt e analisar
      spinner.start("Analisando com Gemini 2.5 Pro...");
      const systemPrompt = await project.loadSystemPrompt();
      
      const result = await analyzeWithGemini({
        heuristics: selected,
        mediaParts: uploadedMedia,
        context: opts.context || "",
        systemPrompt
      });
      spinner.succeed("Análise concluída!");

      // 6. Exibir resultado no terminal
      console.log("\n" + chalk.bold("📊 Resultados:\n"));
      for (const r of result.results) {
        printResult(r);
      }

      if (result.usage) {
        console.log(chalk.dim("\n─────────────────────────────────────"));
        console.log(chalk.dim(`Tokens: ${result.usage.totalTokenCount} (prompt: ${result.usage.promptTokenCount}, resposta: ${result.usage.candidatesTokenCount})`));
      }

      // 7. Salvar se solicitado
      if (opts.output) {
        const { outputPath, format } = resolveOutputPath(opts.output, "results");
        
        if (format === "json") {
          await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        } else {
          const txtContent = formatResultsAsTxt(result.results, project.name, result.usage);
          await fs.writeFile(outputPath, txtContent);
        }
        console.log(chalk.green(`\n✓ Resultado salvo em ${outputPath}`));
      }

    } catch (err) {
      spinner.fail(chalk.red(err.message));
      if (process.env.DEBUG) {
        console.error(err);
      }
      process.exit(1);
    }
  });

program
  .command("projects")
  .description("Listar projetos disponíveis")
  .action(async () => {
    try {
      const projects = await listProjects();
      console.log(chalk.bold("\n📁 Projetos disponíveis:\n"));
      
      for (const p of projects) {
        console.log(`  ${chalk.cyan(p.name)} - ${p.description}`);
        console.log(chalk.dim(`    ${p.heuristicsCount} heurísticas\n`));
      }
    } catch (err) {
      console.error(chalk.red(`Erro: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("heuristics")
  .description("Listar heurísticas de um projeto")
  .option("-g, --group <numero>", "Filtrar por grupo")
  .option("-j, --journey <slug>", "Filtrar por jornada (projetos Finance)")
  .action(async (options, command) => {
    const opts = { ...program.opts(), ...(command?.opts?.() || {}), ...options };
    try {
      const project = await resolveProject(opts.project);
      const heuristics = await project.loadHeuristics();

      console.log(chalk.bold(`\n📋 Heurísticas do projeto ${chalk.cyan(project.name)}:\n`));

      let filtered = heuristics;
      if (opts.group) {
        filtered = filtered.filter(
          (h) => h.group?.groupNumber === parseInt(opts.group)
        );
      }
      if (opts.journey) {
        filtered = filtered.filter((h) => matchesJourney(h, opts.journey));
      }

      const grouped = {};
      for (const h of filtered) {
        const groupName = h.group.name;
        if (!grouped[groupName]) {
          grouped[groupName] = [];
        }
        grouped[groupName].push(h);
      }

      for (const [groupName, items] of Object.entries(grouped)) {
        const groupNum = items[0].group.groupNumber;
        console.log(chalk.yellow(`  Grupo ${groupNum}: ${groupName}`));
        for (const h of items.sort((a, b) => a.heuristicNumber.localeCompare(b.heuristicNumber))) {
          console.log(chalk.dim(`    ${h.heuristicNumber} - ${h.name}`));
        }
        console.log();
      }
    } catch (err) {
      console.error(chalk.red(`Erro: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("init [projeto]")
  .description("Vincular diretório atual a um projeto")
  .action(async (projeto) => {
    try {
      const projects = await listProjects();
      const projectNames = projects.map((p) => p.name);

      if (!projeto) {
        console.log(chalk.yellow("Uso: sherlock init <projeto>"));
        console.log(chalk.dim(`Projetos disponíveis: ${projectNames.join(", ")}`));
        process.exit(1);
      }

      if (!projectNames.includes(projeto)) {
        console.error(chalk.red(`Projeto "${projeto}" não encontrado.`));
        console.log(chalk.dim(`Projetos disponíveis: ${projectNames.join(", ")}`));
        process.exit(1);
      }

      const config = { project: projeto };
      await fs.writeFile(".sherlock.json", JSON.stringify(config, null, 2));
      console.log(chalk.green(`✓ Criado .sherlock.json com projeto "${projeto}"`));
      console.log(chalk.dim("Agora você pode usar 'sherlock video.mp4 3.16' sem a flag -p"));
    } catch (err) {
      console.error(chalk.red(`Erro: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("batch <arquivo>")
  .description("Analisar múltiplas heurísticas a partir de um arquivo (TXT ou JSON)")
  .option("-c, --context <texto>", "Contexto global (aplicado a todas as análises)")
  .option("-o, --output <arquivo>", "Formato de saída (txt, json, ou nome.ext). Default: txt")
  .option("--continue-on-error", "Continuar mesmo se uma análise falhar")
  .action(async (arquivo, options, command) => {
    const spinner = ora();
    const opts = { ...program.opts(), ...(command?.opts?.() || {}), ...options };

    try {
      // 1. Resolver projeto
      const project = await resolveProject(opts.project);
      console.log(chalk.dim(`\nUsando projeto: ${chalk.cyan(project.name)}\n`));

      // 2. Carregar heurísticas do projeto
      const allHeuristics = await project.loadHeuristics();
      const systemPrompt = await project.loadSystemPrompt();

      // 3. Parsear arquivo batch
      const batchItems = await parseBatchFile(arquivo);
      if (!batchItems || batchItems.length === 0) {
        console.error(chalk.red("Nenhum item válido encontrado no arquivo batch."));
        process.exit(1);
      }

      console.log(chalk.bold(`📦 Análise em lote: ${path.basename(arquivo)} (${batchItems.length} itens)\n`));

      // 4. Validar heurísticas e resolver arquivos
      const requiresJourney = project.meta?.requiresJourney === true;
      const validatedItems = [];

      for (const item of batchItems) {
        if (requiresJourney && !item.journey) {
          const journeys = getUniqueJourneySlugs(allHeuristics);
          console.error(chalk.red(`Projeto Finance exige jornada. Use formato 3.16:abertura ou "journey" no JSON.`));
          console.error(chalk.dim(`Jornadas disponíveis: ${journeys.join(", ")}`));
          if (!opts.continueOnError) process.exit(1);
          continue;
        }

        let heuristic;
        try {
          heuristic = findHeuristicByNumberAndJourney(allHeuristics, item.heuristic, item.journey, project.meta);
        } catch (err) {
          console.error(chalk.red(err.message));
          if (!opts.continueOnError) process.exit(1);
          continue;
        }

        if (!heuristic) {
          const journeyPart = item.journey ? `:${item.journey}` : "";
          console.error(chalk.red(`Heurística não encontrada: ${item.heuristic}${journeyPart}`));
          if (!opts.continueOnError) process.exit(1);
          continue;
        }

        const filePaths = [];
        for (const ev of item.evidence) {
          const fp = await resolveFile(ev, true);
          if (!fp) {
            console.error(chalk.red(`Arquivo não encontrado: ${ev}`));
            if (!opts.continueOnError) process.exit(1);
            break;
          }
          filePaths.push(fp);
        }
        if (filePaths.length !== item.evidence.length) continue;

        validatedItems.push({
          heuristic,
          heuristicNumber: item.heuristic,
          journeySlug: item.journey,
          filePaths,
          fileNames: filePaths.map((p) => path.basename(p)),
          mediaParts: filePaths.map((p) => ({ path: p, mimeType: getMimeType(p) })),
          context: item.context || opts.context || ""
        });
      }

      if (validatedItems.length === 0) {
        console.error(chalk.red("Nenhum item válido para processar."));
        process.exit(1);
      }

      // 5. Processar cada item
      const allResults = [];
      let totalTokens = 0;
      let passCount = 0;
      let failCount = 0;
      let rejectCount = 0;

      for (let i = 0; i < validatedItems.length; i++) {
        const item = validatedItems[i];
        const progress = `[${i + 1}/${validatedItems.length}]`;

        const journeyPart = item.journeySlug ? ` [${item.journeySlug}]` : "";
        console.log(chalk.bold(`${progress} ${item.heuristicNumber}${journeyPart} → ${item.fileNames.join(", ")}`));

        try {
          // Upload
          spinner.start("  Enviando para o Gemini...");
          const uploadedMedia = [];
          for (const mp of item.mediaParts) {
            const { fileUri } = await uploadLocalFile(mp.path, mp.mimeType);
            uploadedMedia.push({ fileUri, mimeType: mp.mimeType });
          }
          spinner.succeed("  Upload concluído");

          // Análise
          spinner.start("  Analisando...");
          const result = await analyzeWithGemini({
            heuristics: [item.heuristic],
            mediaParts: uploadedMedia,
            context: item.context,
            systemPrompt
          });
          spinner.succeed("  Análise concluída");

          // Processar resultado
          const r = result.results[0];
          allResults.push({
            heuristicNumber: item.heuristicNumber,
            name: item.heuristic.name,
            fileName: item.fileNames.join(", "),
            ...r
          });

          if (r.rejected) {
            rejectCount++;
            console.log(chalk.red(`  ✗ REJEITADA: ${r.rejectionReason}`));
          } else if (r.score >= 4) {
            passCount++;
            console.log(chalk.green(`  ✓ Score: ${r.score}/5`));
          } else {
            failCount++;
            console.log(chalk.yellow(`  ● Score: ${r.score}/5`));
          }

          if (result.usage) {
            totalTokens += result.usage.totalTokenCount || 0;
          }

          console.log();

        } catch (err) {
          spinner.fail(chalk.red(`  Erro: ${err.message}`));
          allResults.push({
            heuristicNumber: item.heuristicNumber,
            name: item.heuristic.name,
            fileName: item.fileNames.join(", "),
            error: err.message
          });

          if (!opts.continueOnError) {
            process.exit(1);
          }
          console.log();
        }
      }

      // 6. Resumo final
      console.log(chalk.dim("─────────────────────────────────────────────────"));
      console.log(chalk.bold(`📊 Resumo: ${validatedItems.length} análises | `) +
        chalk.green(`${passCount} pass`) + " | " +
        chalk.yellow(`${failCount} fail`) +
        (rejectCount > 0 ? " | " + chalk.red(`${rejectCount} rejected`) : ""));
      console.log(chalk.dim(`   Tokens totais: ${totalTokens.toLocaleString()}`));

      // 7. Salvar resultados (TXT por default)
      const batchBaseName = path.basename(arquivo, path.extname(arquivo));
      const defaultOutputName = `results_${batchBaseName}`;
      const { outputPath, format } = resolveOutputPath(opts.output || "txt", defaultOutputName);

      const summary = { total: validatedItems.length, pass: passCount, fail: failCount, rejected: rejectCount, totalTokens };

      if (format === "json") {
        const outputData = {
          batchFile: arquivo,
          project: project.name,
          timestamp: new Date().toISOString(),
          summary,
          results: allResults
        };
        await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
      } else {
        const txtContent = formatBatchResultsAsTxt(allResults, project.name, summary, arquivo);
        await fs.writeFile(outputPath, txtContent);
      }

      console.log(chalk.green(`\n✓ Resultados salvos em ${outputPath}`));

    } catch (err) {
      spinner.fail(chalk.red(err.message));
      if (process.env.DEBUG) {
        console.error(err);
      }
      process.exit(1);
    }
  });

program.parse();

/**
 * Parseia arquivo batch (TXT ou JSON)
 * TXT: "heuristica arquivo" ou "heuristica:jornada arquivo" (para projetos Finance)
 * JSON: array de { heuristic, evidence, context?, journey? }
 */
async function parseBatchFile(filePath) {
  const resolvedPath = path.resolve(filePath);

  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error(`Arquivo batch não encontrado: ${filePath}`);
  }

  const content = await fs.readFile(resolvedPath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    try {
      const items = JSON.parse(content);
      if (!Array.isArray(items)) {
        throw new Error("Arquivo JSON deve conter um array de itens.");
      }
      return items.map((item) => {
        const heuristicStr = String(item.heuristic || item.heuristicNumber || "");
        const colonIdx = heuristicStr.indexOf(":");
        const heuristic = colonIdx >= 0 ? heuristicStr.slice(0, colonIdx) : heuristicStr;
        const journey = colonIdx >= 0 ? heuristicStr.slice(colonIdx + 1) : (item.journey || "");
        const raw = item.evidence ?? item.file ?? item.video;
        const evidence = Array.isArray(raw)
          ? raw.map((x) => String(x).trim()).filter(Boolean)
          : (typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []);
        return {
          heuristic,
          journey: journey.trim(),
          evidence,
          context: item.context || ""
        };
      }).filter((item) => item.heuristic && item.evidence.length > 0);
    } catch (err) {
      throw new Error(`Erro ao parsear JSON: ${err.message}`);
    }
  }

  // Formato TXT
  const lines = content.split("\n");
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0];
      const colonIdx = first.indexOf(":");
      const heuristic = colonIdx >= 0 ? first.slice(0, colonIdx) : first;
      const journey = colonIdx >= 0 ? first.slice(colonIdx + 1) : "";
      const evidenceStr = parts.slice(1).join(" ");
      const evidence = evidenceStr.split(",").map((s) => s.trim()).filter(Boolean);
      items.push({
        heuristic,
        journey,
        evidence,
        context: ""
      });
    }
  }

  return items;
}

/**
 * Resolve arquivo por nome exato ou parcial
 * Suporta: "video.mp4" ou "vid" (encontra arquivos que começam com "vid")
 * @param {string} input - Nome ou caminho do arquivo
 * @param {boolean} silent - Se true, não exibe mensagens (usado no batch)
 */
async function resolveFile(input, silent = false) {
  const inputPath = path.resolve(input);

  // 1. Tentar caminho exato
  try {
    await fs.access(inputPath);
    return inputPath;
  } catch {
    // Não encontrou exato, tentar match parcial
  }

  // 2. Buscar por nome parcial no diretório atual
  const dir = path.dirname(inputPath);
  const partial = path.basename(input).toLowerCase();

  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    if (!silent) console.error(chalk.red(`Erro: Diretório não encontrado: ${dir}`));
    return null;
  }

  // Extensões de mídia suportadas
  const mediaExtensions = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

  // Filtrar arquivos que começam com o padrão e são mídia
  const matches = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    const nameWithoutExt = f.toLowerCase();
    return nameWithoutExt.startsWith(partial) && mediaExtensions.includes(ext);
  });

  if (matches.length === 0) {
    if (!silent) {
      console.error(chalk.red(`Erro: Nenhum arquivo encontrado com "${input}"`));
      console.log(chalk.dim("Dica: verifique o nome do arquivo ou use tab para autocompletar"));
    }
    return null;
  }

  if (matches.length === 1) {
    const resolved = path.join(dir, matches[0]);
    if (!silent) console.log(chalk.dim(`Arquivo encontrado: ${matches[0]}`));
    return resolved;
  }

  // Múltiplos matches - mostrar opções
  if (!silent) {
    console.error(chalk.yellow(`Múltiplos arquivos encontrados com "${input}":\n`));
    matches.forEach((m, i) => {
      console.log(chalk.dim(`  ${i + 1}. ${m}`));
    });
    console.log(chalk.yellow("\nSeja mais específico no nome do arquivo."));
  }
  return null;
}

/**
 * Resolve um ou mais arquivos (separados por vírgula)
 */
async function resolveFiles(input, silent = false) {
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  const resolved = [];
  for (const part of parts) {
    const p = await resolveFile(part, silent);
    if (!p) return null;
    resolved.push(p);
  }
  return resolved.length > 0 ? resolved : null;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  return types[ext] || "application/octet-stream";
}

function filterByNumber(heuristics, numbers) {
  return heuristics.filter((h) => numbers.includes(h.heuristicNumber));
}

/**
 * Verifica se heurística pertence à jornada (slug)
 * Suporta h.journey.slug (finance) e h.journeys[].slug (retail)
 */
function matchesJourney(h, journeySlug) {
  if (!journeySlug) return true;
  const slug = journeySlug.toLowerCase();
  if (h.journey?.slug) return h.journey.slug.toLowerCase() === slug;
  if (h.journeys?.length) return h.journeys.some((j) => j.slug?.toLowerCase() === slug);
  return false;
}

/**
 * Retorna slugs únicos de jornadas nas heurísticas
 */
function getUniqueJourneySlugs(heuristics) {
  const slugs = new Set();
  for (const h of heuristics) {
    if (h.journey?.slug) slugs.add(h.journey.slug);
    if (h.journeys) for (const j of h.journeys) if (j.slug) slugs.add(j.slug);
  }
  return [...slugs].sort();
}

/**
 * Encontra uma heurística por número e jornada
 */
function findHeuristicByNumberAndJourney(heuristics, number, journeySlug, meta) {
  const requiresJourney = meta?.requiresJourney === true;

  if (requiresJourney && !journeySlug) {
    const available = getUniqueJourneySlugs(heuristics);
    throw new Error(
      `Projeto Finance exige jornada. Use -j <slug>.\n` +
      `Jornadas disponíveis: ${available.join(", ")}`
    );
  }

  const matches = heuristics.filter(
    (h) => h.heuristicNumber === number && matchesJourney(h, journeySlug)
  );

  if (matches.length === 0) return null;
  if (matches.length > 1) return matches[0]; // edge case
  return matches[0];
}

/**
 * Filtra heurísticas por número e (opcionalmente) jornada
 * Projetos com requiresJourney exigem journey; retail ignora
 */
function filterByNumberAndJourney(heuristics, numbers, journeySlug, meta) {
  const requiresJourney = meta?.requiresJourney === true;

  if (requiresJourney && !journeySlug) {
    const available = getUniqueJourneySlugs(heuristics);
    throw new Error(
      `Projeto Finance exige jornada. Use -j <slug>.\n` +
      `Ex: sherlock -p finance5 -j abertura video.mp4 1.3\n` +
      `Jornadas disponíveis: ${available.join(", ")}`
    );
  }

  const result = [];
  for (const num of numbers) {
    const h = heuristics.find(
      (x) => x.heuristicNumber === num && matchesJourney(x, journeySlug)
    );
    if (h) result.push(h);
  }
  return result;
}

function printResult(r) {
  if (r.raw) {
    console.log(chalk.dim("Resposta bruta:"));
    console.log(r.raw);
    return;
  }

  if (r.rejected) {
    console.log(chalk.red(`❌ Heurística ${r.heuristicNumber}: ${r.name}`));
    console.log(chalk.red(`   REJEITADA: ${r.rejectionReason}\n`));
    return;
  }

  const scoreColor = r.score >= 4 ? chalk.green : r.score >= 3 ? chalk.yellow : chalk.red;
  const icon = r.score >= 4 ? "✓" : r.score >= 3 ? "●" : "✗";

  console.log(chalk.cyan(`${r.heuristicNumber}: ${r.name}`));
  console.log(`  ${icon} Score: ${scoreColor(r.score + "/5")}`);
  console.log(chalk.dim(`  ${r.justification}\n`));
}

/**
 * Resolve o caminho e formato do arquivo de saída
 * Aceita: "txt", "json", "nome.txt", "nome.json", "nome" (assume txt)
 */
function resolveOutputPath(output, defaultName) {
  // Se for apenas "txt" ou "json", usa nome default
  if (output === "txt") {
    return { outputPath: `${defaultName}.txt`, format: "txt" };
  }
  if (output === "json") {
    return { outputPath: `${defaultName}.json`, format: "json" };
  }

  // Se tiver extensão, usa ela
  const ext = path.extname(output).toLowerCase();
  if (ext === ".json") {
    return { outputPath: output, format: "json" };
  }
  if (ext === ".txt") {
    return { outputPath: output, format: "txt" };
  }

  // Sem extensão, assume txt
  return { outputPath: `${output}.txt`, format: "txt" };
}

/**
 * Formata resultados de análise simples como TXT
 */
function formatResultsAsTxt(results, projectName, usage) {
  const timestamp = new Date().toLocaleString("pt-BR");
  let txt = `# Análise Sherlock - ${timestamp}\n`;
  txt += `# Projeto: ${projectName}\n\n`;

  for (const r of results) {
    txt += `## ${r.heuristicNumber} - ${r.name}\n`;
    
    if (r.rejected) {
      txt += `Status: REJEITADA\n`;
      txt += `Motivo: ${r.rejectionReason}\n`;
    } else if (r.error) {
      txt += `Status: ERRO\n`;
      txt += `Motivo: ${r.error}\n`;
    } else {
      txt += `Score: ${r.score}/5\n`;
      txt += `\n${r.justification}\n`;
    }
    
    txt += `\n---\n\n`;
  }

  if (usage) {
    txt += `Tokens: ${usage.totalTokenCount?.toLocaleString() || 0}\n`;
  }

  return txt;
}

/**
 * Formata resultados de análise batch como TXT
 */
function formatBatchResultsAsTxt(results, projectName, summary, batchFile) {
  const timestamp = new Date().toLocaleString("pt-BR");
  let txt = `# Análise Sherlock (Batch) - ${timestamp}\n`;
  txt += `# Projeto: ${projectName}\n`;
  txt += `# Arquivo: ${batchFile}\n`;
  txt += `# Resumo: ${summary.total} análises | ${summary.pass} pass | ${summary.fail} fail`;
  if (summary.rejected > 0) txt += ` | ${summary.rejected} rejected`;
  txt += `\n\n`;

  for (const r of results) {
    txt += `## ${r.heuristicNumber} - ${r.name || "N/A"}\n`;
    txt += `Arquivo: ${r.fileName}\n`;
    
    if (r.rejected) {
      txt += `Status: REJEITADA\n`;
      txt += `Motivo: ${r.rejectionReason}\n`;
    } else if (r.error) {
      txt += `Status: ERRO\n`;
      txt += `Motivo: ${r.error}\n`;
    } else {
      txt += `Score: ${r.score}/5\n`;
      txt += `\n${r.justification}\n`;
    }
    
    txt += `\n---\n\n`;
  }

  txt += `Tokens totais: ${summary.totalTokens?.toLocaleString() || 0}\n`;

  return txt;
}
