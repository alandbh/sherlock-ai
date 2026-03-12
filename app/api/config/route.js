import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "config.json");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const config = JSON.parse(fileContent);
    return Response.json({ projects: config.projects || [] });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Erro ao carregar configuração." },
      { status: 500 }
    );
  }
}
