import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const folder = formData.get("folder") as string || "geral";

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Caminho relativo para a pasta de fotos no public
        const relativePath = join("fotos", folder);
        const absolutePath = join(process.cwd(), "public", relativePath);

        // Garantir que o diretório existe
        if (!existsSync(absolutePath)) {
            await mkdir(absolutePath, { recursive: true });
        }

        const fileName = file.name;
        const filePath = join(absolutePath, fileName);

        await writeFile(filePath, buffer);

        const fileUrl = `/${relativePath.replace(/\\/g, '/')}/${fileName}`;

        console.log(`[UPLOAD] Arquivo salvo em: ${fileUrl}`);

        return NextResponse.json({ success: true, url: fileUrl });
    } catch (error) {
        console.error("Erro no upload:", error);
        return NextResponse.json({ error: "Falha ao salvar arquivo" }, { status: 500 });
    }
}
