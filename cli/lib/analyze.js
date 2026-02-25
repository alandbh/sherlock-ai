import { GoogleGenerativeAI } from "@google/generative-ai";

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
 * Analisa evidências com Gemini usando heurísticas e system prompt
 */
export async function analyzeWithGemini({ heuristics, mediaParts, context, systemPrompt }) {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: systemPrompt || ""
  });

  // Montar parts do conteúdo
  const parts = [
    {
      text:
        `Contexto adicional:\n${context || "Não informado."}\n\n` +
        `Heurísticas JSON:\n${JSON.stringify(heuristics, null, 2)}`
    }
  ];

  // Adicionar referências de mídia (já uploadadas)
  for (const mp of mediaParts) {
    parts.push({
      fileData: {
        fileUri: mp.fileUri,
        mimeType: mp.mimeType
      }
    });
  }

  // Chamar Gemini
  const result = await model.generateContent({
    contents: [{ role: "user", parts }]
  });

  const usage = result.response.usageMetadata || null;
  const responseText = result.response.text();

  // Extrair JSON da resposta
  const parsed = extractJson(responseText);

  return {
    results: parsed?.results || [{ raw: responseText }],
    usage: usage
      ? {
          promptTokenCount: usage.promptTokenCount ?? 0,
          candidatesTokenCount: usage.candidatesTokenCount ?? 0,
          totalTokenCount: usage.totalTokenCount ?? 0
        }
      : null
  };
}

/**
 * Extrai JSON da resposta do Gemini, tratando possíveis code fences
 */
function extractJson(text) {
  // Tentar parse direto
  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  // Tentar extrair de markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      // noop
    }
  }

  // Tentar encontrar objeto JSON no texto
  const jsonMatch = text.match(/\{[\s\S]*"results"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // noop
    }
  }

  return null;
}
