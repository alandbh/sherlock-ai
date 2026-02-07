import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/files";
import { createHash } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

export const runtime = "nodejs";

async function fetchDriveFile(accessToken, file) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo ${file.name}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function cleanupGhostFiles(fileManager) {
  try {
    const listResult = await fileManager.listFiles();
    if (!listResult.files) return;
    for (const f of listResult.files) {
      // Deletar arquivos fantasma (name "undefined") ou com estado FAILED
      if (
        f.name === "files/undefined" ||
        f.displayName === "undefined" ||
        f.state === "FAILED"
      ) {
        await fileManager.deleteFile(f.name).catch(() => { });
      }
    }
  } catch {
    // ignora erros na limpeza
  }
}

async function findExistingFile(fileManager, resourceName) {
  try {
    const file = await fileManager.getFile(resourceName);
    if (file && (file.state === "ACTIVE" || file.state === "PROCESSING")) {
      return file;
    }
    return null;
  } catch {
    return null;
  }
}

async function waitForFileActive(fileManager, fileName, maxWaitMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const file = await fileManager.getFile(fileName);
    if (file.state === "ACTIVE") return file;
    if (file.state === "FAILED") throw new Error(`File processing failed: ${fileName}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Timeout waiting for file ${fileName} to become ACTIVE.`);
}

async function uploadVideoToGemini(fileManager, file, buffer) {
  // Nome de recurso único, determinístico e ≤ 40 chars
  const hash = createHash("sha256").update(file.id).digest("hex").slice(0, 32);
  const resourceName = `sh-${hash}`;

  // 1. Limpar arquivos fantasma de tentativas anteriores
  await cleanupGhostFiles(fileManager);

  // 2. Verificar se já existe upload deste arquivo
  const existing = await findExistingFile(fileManager, `files/${resourceName}`);
  if (existing) {
    if (existing.state === "ACTIVE") return existing;
    return waitForFileActive(fileManager, existing.name);
  }

  // 3. Upload novo — com name explícito para evitar "files/undefined"
  const extension = file.mimeType.split("/")[1] || "bin";
  const tempPath = path.join(os.tmpdir(), `${resourceName}-${Date.now()}.${extension}`);

  await fs.writeFile(tempPath, buffer);
  try {
    const uploadResult = await fileManager.uploadFile(tempPath, {
      mimeType: file.mimeType,
      displayName: file.name,
      name: resourceName
    });

    const uploaded = uploadResult.file;
    if (uploaded.state === "PROCESSING") {
      return waitForFileActive(fileManager, uploaded.name);
    }
    return uploaded;
  } catch (err) {
    if (err.status === 409) {
      // Arquivo já existe — tentar reusar
      const fallback = await findExistingFile(fileManager, `files/${resourceName}`);
      if (fallback) {
        if (fallback.state === "ACTIVE") return fallback;
        return waitForFileActive(fileManager, fallback.name);
      }
      // Se não encontrou por name, tentar deletar e re-upload
      await fileManager.deleteFile(`files/${resourceName}`).catch(() => { });
      const retryResult = await fileManager.uploadFile(tempPath, {
        mimeType: file.mimeType,
        displayName: file.name,
        name: resourceName
      });
      return retryResult.file;
    }
    throw err;
  } finally {
    await fs.unlink(tempPath).catch(() => { });
  }
}

async function loadSystemPrompt() {
  const filePath = path.join(process.cwd(), "system_prompt.txt");
  const content = await fs.readFile(filePath, "utf-8");
  const firstTick = content.indexOf("`");
  const lastTick = content.lastIndexOf("`");
  if (firstTick === -1 || lastTick === -1 || lastTick <= firstTick) {
    return content.trim();
  }
  return content.slice(firstTick + 1, lastTick).trim();
}

export async function POST(request) {
  try {
    const { accessToken, heuristics, files, context } = await request.json();

    if (!accessToken || !files?.length) {
      return Response.json({ error: "Dados insuficientes." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY ausente." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    const systemPrompt = await loadSystemPrompt();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: systemPrompt || ""
    });

    const parts = [
      {
        text: `Contexto adicional:\n${context || "Não informado."}\n\nHeurísticas JSON:\n${JSON.stringify(
          heuristics || [],
          null,
          2
        )}`
      }
    ];

    for (const file of files) {
      const buffer = await fetchDriveFile(accessToken, file);
      if (file.mimeType?.startsWith("video/")) {
        const uploadedFile = await uploadVideoToGemini(fileManager, file, buffer);
        parts.push({
          fileData: {
            fileUri: uploadedFile.uri,
            mimeType: uploadedFile.mimeType
          }
        });
      } else if (file.mimeType?.startsWith("image/")) {
        parts.push({
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: file.mimeType
          }
        });
      }
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }]
    });

    const usage = result.response.usageMetadata || null;

    return Response.json({
      text: result.response.text(),
      usage: usage
        ? {
          promptTokenCount: usage.promptTokenCount ?? 0,
          candidatesTokenCount: usage.candidatesTokenCount ?? 0,
          totalTokenCount: usage.totalTokenCount ?? 0
        }
        : null
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro ao gerar avaliação." }, { status: 500 });
  }
}
