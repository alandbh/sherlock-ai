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
  .version("1.0.0", "-v, --version");

program
  .argument("<video>", "Caminho do vídeo ou imagem")
  .argument("<heuristicas>", "Números das heurísticas (ex: 3.16 ou 3.16,3.17)")
  .option("-p, --project <nome>", "Nome do projeto (retail6, finance, etc)")
  .option("-c, --context <texto>", "Contexto adicional")
  .option("-o, --output <arquivo>", "Salvar resultado em arquivo JSON")
  .option("--json", "Exibir resultado em formato JSON")
  .action(async (video, heuristicasArg, options) => {
    const spinner = ora();

    try {
      // 1. Resolver projeto
      const project = await resolveProject(options.project);
      console.log(chalk.dim(`\nUsando projeto: ${chalk.cyan(project.name)}\n`));

      // 2. Resolver arquivo (suporta nome parcial)
      const videoPath = await resolveFile(video);
      if (!videoPath) {
        process.exit(1);
      }

      const mimeType = getMimeType(videoPath);
      const fileName = path.basename(videoPath);

      // 3. Carregar heurísticas do projeto
      spinner.start("Carregando heurísticas...");
      const allHeuristics = await project.loadHeuristics();
      const numeros = heuristicasArg.split(",").map((n) => n.trim());
      const selected = filterByNumber(allHeuristics, numeros);

      if (selected.length === 0) {
        spinner.fail(chalk.red(`Nenhuma heurística encontrada: ${heuristicasArg}`));
        console.log(chalk.dim("\nHeurísticas disponíveis:"));
        const available = allHeuristics.map((h) => h.heuristicNumber).sort();
        console.log(chalk.dim(available.join(", ")));
        process.exit(1);
      }
      spinner.succeed(`${selected.length} heurística(s) selecionada(s): ${numeros.join(", ")}`);

      // 4. Upload para Gemini
      spinner.start(`Enviando ${chalk.cyan(fileName)} para o Gemini...`);
      const { fileUri } = await uploadLocalFile(videoPath, mimeType);
      spinner.succeed(`Upload concluído: ${fileName}`);

      // 5. Carregar system prompt e analisar
      spinner.start("Analisando com Gemini 2.5 Pro...");
      const systemPrompt = await project.loadSystemPrompt();
      
      const result = await analyzeWithGemini({
        heuristics: selected,
        mediaParts: [{ fileUri, mimeType }],
        context: options.context || "",
        systemPrompt
      });
      spinner.succeed("Análise concluída!");

      // 6. Exibir resultado
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("\n" + chalk.bold("📊 Resultados:\n"));
        for (const r of result.results) {
          printResult(r);
        }

        if (result.usage) {
          console.log(chalk.dim("\n─────────────────────────────────────"));
          console.log(chalk.dim(`Tokens: ${result.usage.totalTokenCount} (prompt: ${result.usage.promptTokenCount}, resposta: ${result.usage.candidatesTokenCount})`));
        }
      }

      // 7. Salvar se solicitado
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(chalk.green(`\n✓ Resultado salvo em ${options.output}`));
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
  .option("-p, --project <nome>", "Nome do projeto")
  .option("-g, --group <numero>", "Filtrar por grupo")
  .action(async (options) => {
    try {
      const project = await resolveProject(options.project);
      const heuristics = await project.loadHeuristics();

      console.log(chalk.bold(`\n📋 Heurísticas do projeto ${chalk.cyan(project.name)}:\n`));

      let filtered = heuristics;
      if (options.group) {
        filtered = heuristics.filter(
          (h) => h.group.groupNumber === parseInt(options.group)
        );
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
  .option("-p, --project <nome>", "Nome do projeto")
  .option("-c, --context <texto>", "Contexto global (aplicado a todas as análises)")
  .option("-o, --output <arquivo>", "Salvar todos os resultados em JSON")
  .option("--continue-on-error", "Continuar mesmo se uma análise falhar")
  .action(async (arquivo, options) => {
    const spinner = ora();

    try {
      // 1. Resolver projeto
      const project = await resolveProject(options.project);
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
      const validatedItems = [];
      for (const item of batchItems) {
        const heuristic = allHeuristics.find((h) => h.heuristicNumber === item.heuristic);
        if (!heuristic) {
          console.error(chalk.red(`Heurística não encontrada: ${item.heuristic}`));
          if (!options.continueOnError) process.exit(1);
          continue;
        }

        const filePath = await resolveFile(item.evidence, true);
        if (!filePath) {
          console.error(chalk.red(`Arquivo não encontrado: ${item.evidence}`));
          if (!options.continueOnError) process.exit(1);
          continue;
        }

        validatedItems.push({
          heuristic,
          heuristicNumber: item.heuristic,
          filePath,
          fileName: path.basename(filePath),
          mimeType: getMimeType(filePath),
          context: item.context || options.context || ""
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

        console.log(chalk.bold(`${progress} ${item.heuristicNumber} → ${item.fileName}`));

        try {
          // Upload
          spinner.start("  Enviando para o Gemini...");
          const { fileUri } = await uploadLocalFile(item.filePath, item.mimeType);
          spinner.succeed("  Upload concluído");

          // Análise
          spinner.start("  Analisando...");
          const result = await analyzeWithGemini({
            heuristics: [item.heuristic],
            mediaParts: [{ fileUri, mimeType: item.mimeType }],
            context: item.context,
            systemPrompt
          });
          spinner.succeed("  Análise concluída");

          // Processar resultado
          const r = result.results[0];
          allResults.push({
            heuristicNumber: item.heuristicNumber,
            fileName: item.fileName,
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
            fileName: item.fileName,
            error: err.message
          });

          if (!options.continueOnError) {
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

      // 7. Salvar se solicitado
      if (options.output) {
        const outputData = {
          batchFile: arquivo,
          project: project.name,
          timestamp: new Date().toISOString(),
          summary: { total: validatedItems.length, pass: passCount, fail: failCount, rejected: rejectCount, totalTokens },
          results: allResults
        };
        await fs.writeFile(options.output, JSON.stringify(outputData, null, 2));
        console.log(chalk.green(`\n✓ Resultados salvos em ${options.output}`));
      }

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
 * TXT: linhas no formato "heuristica arquivo" (ignora linhas vazias e comentários #)
 * JSON: array de { heuristic, evidence, context? }
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
      return items.map((item) => ({
        heuristic: String(item.heuristic || item.heuristicNumber),
        evidence: item.evidence || item.file || item.video,
        context: item.context || ""
      })).filter((item) => item.heuristic && item.evidence);
    } catch (err) {
      throw new Error(`Erro ao parsear JSON: ${err.message}`);
    }
  }

  // Formato TXT (default)
  const lines = content.split("\n");
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Ignorar linhas vazias e comentários
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Formato: "heuristica arquivo" ou "heuristica    arquivo" (múltiplos espaços/tabs)
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      items.push({
        heuristic: parts[0],
        evidence: parts.slice(1).join(" "), // Permite nomes com espaço
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
