import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/files";
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

async function uploadVideoToGemini(fileManager, file, buffer) {
  const extension = file.mimeType.split("/")[1] || "bin";
  const uniqueName = `sherlock-${file.id}-${Date.now()}`;
  const tempPath = path.join(
    os.tmpdir(),
    `${uniqueName}.${extension}`
  );

  await fs.writeFile(tempPath, buffer);
  try {
    const uploadResult = await fileManager.uploadFile(tempPath, {
      mimeType: file.mimeType,
      displayName: `${file.name}-${Date.now()}`
    });
    return uploadResult.file;
  } catch (err) {
    // Se 409 (arquivo já existe), tenta listar e reusar
    if (err.status === 409) {
      const listResult = await fileManager.listFiles();
      const existing = listResult.files?.find(
        (f) => f.displayName === file.name && f.state === "ACTIVE"
      );
      if (existing) return existing;
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
      model: "gemini-2.5-flash",
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

    return Response.json({ text: result.response.text() });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro ao gerar avaliação." }, { status: 500 });
  }
}
