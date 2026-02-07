import fs from "fs/promises";
import path from "path";
import { groupHeuristics } from "@/lib/heuristics";

export const runtime = "nodejs";

async function loadHeuristics() {
  const filePath = path.join(process.cwd(), "heuristics.json");
  const fileContent = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(fileContent);
  return parsed?.data?.heuristics || [];
}

export async function GET() {
  try {
    const heuristics = await loadHeuristics();
    const groups = groupHeuristics(heuristics);
    return Response.json({ groups });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro ao carregar heurísticas." }, { status: 500 });
  }
}
