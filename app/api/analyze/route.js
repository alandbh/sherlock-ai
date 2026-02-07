import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function loadSystemPrompt() {
  const filePath = path.join(process.cwd(), "system_prompt.txt");
  return (await fs.readFile(filePath, "utf-8")).trim();
}

/**
 * Extract JSON from the Gemini response text.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function extractJson(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      // noop
    }
  }

  // Try finding a JSON object in the text
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

/* ------------------------------------------------------------------ */
/*  POST /api/analyze                                                  */
/*                                                                     */
/*  Body:                                                              */
/*    heuristics  – array of selected heuristic objects                */
/*    mediaParts  – array of { fileUri, mimeType }                     */
/*    context     – optional extra context string                      */
/* ------------------------------------------------------------------ */

export async function POST(request) {
  try {
    const { heuristics, mediaParts, context } = await request.json();

    if (!mediaParts?.length) {
      return Response.json(
        { error: "Nenhum arquivo de mídia fornecido." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "GEMINI_API_KEY ausente." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const systemPrompt = await loadSystemPrompt();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: systemPrompt || ""
    });

    /* ---- Build content parts ---- */
    const parts = [
      {
        text:
          `Contexto adicional:\n${context || "Não informado."}\n\n` +
          `Heurísticas JSON:\n${JSON.stringify(heuristics || [], null, 2)}`
      }
    ];

    // All media arrive as Gemini fileUri references (uploaded client-side)
    for (const mp of mediaParts) {
      parts.push({
        fileData: {
          fileUri: mp.fileUri,
          mimeType: mp.mimeType
        }
      });
    }

    /* ---- Call Gemini ---- */
    const result = await model.generateContent({
      contents: [{ role: "user", parts }]
    });

    const usage = result.response.usageMetadata || null;
    const responseText = result.response.text();

    // Try to parse structured JSON from the response
    const parsed = extractJson(responseText);

    if (parsed && Array.isArray(parsed.results)) {
      return Response.json({
        results: parsed.results,
        usage: usage
          ? {
              promptTokenCount: usage.promptTokenCount ?? 0,
              candidatesTokenCount: usage.candidatesTokenCount ?? 0,
              totalTokenCount: usage.totalTokenCount ?? 0
            }
          : null
      });
    }

    // Fallback: return raw text as a single result
    return Response.json({
      results: [{ raw: responseText }],
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
    return Response.json(
      { error: "Erro ao gerar avaliação." },
      { status: 500 }
    );
  }
}
