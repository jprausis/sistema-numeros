import { NextRequest, NextResponse } from "next/server";
import { processExcelImport } from "@/lib/importService";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const bairroNome = formData.get("bairro") as string;

        if (!file || !bairroNome) {
            return NextResponse.json({ error: "Arquivo e nome do bairro são obrigatórios" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        let result;
        if (file.name.endsWith('.geojson')) {
            const { processGeoJSONImport } = await import("@/lib/importService");
            result = await processGeoJSONImport(buffer);
        } else {
            result = await processExcelImport(buffer, bairroNome);
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Erro na importação:", error);
        return NextResponse.json({ error: error.message || "Erro interno no servidor" }, { status: 500 });
    }
}
