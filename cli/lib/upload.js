import fs from "fs/promises";
import path from "path";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY não configurada.\n" +
      "Configure com: export GEMINI_API_KEY='sua-chave-aqui'"
    );
  }
  return key;
}

/**
 * Upload arquivo LOCAL para Gemini Files API (protocolo resumable)
 */
export async function uploadLocalFile(filePath, mimeType) {
  const apiKey = getApiKey();
  const fileBuffer = await fs.readFile(filePath);
  const fileSize = fileBuffer.length;
  const displayName = path.basename(filePath);

  // Step 1: Iniciar upload resumable
  const initRes = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileSize),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ file: { displayName } })
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Upload falhou na inicialização (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("Gemini não retornou URL de upload.");
  }

  // Step 2: Enviar dados do arquivo
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileSize),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize"
    },
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Upload falhou no envio (${uploadRes.status}): ${errText}`);
  }

  const data = await uploadRes.json();
  const file = data.file;

  // Step 3: Aguardar ACTIVE (necessário para vídeos)
  if (file.state !== "ACTIVE") {
    return await waitForActive(file.name);
  }

  return { fileUri: file.uri, mimeType: file.mimeType };
}

async function waitForActive(fileName, maxWaitMs = 180_000) {
  const apiKey = getApiKey();
  const start = Date.now();
  let dots = 0;

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${GEMINI_API_BASE}/v1beta/${fileName}?key=${apiKey}`
    );

    if (!res.ok) {
      throw new Error(`Erro ao verificar status do arquivo (${res.status}).`);
    }

    const file = await res.json();

    if (file.state === "ACTIVE") {
      return { fileUri: file.uri, mimeType: file.mimeType };
    }

    if (file.state === "FAILED") {
      throw new Error("Processamento do vídeo falhou no Gemini.");
    }

    // Aguardar 3 segundos antes de verificar novamente
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Timeout aguardando processamento do vídeo (máx: 3 min).");
}
