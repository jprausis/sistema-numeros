import { NextRequest, NextResponse } from "next/server";
import {
    processExcelImport,
    processGeoJSONImport,
    processComplementoImport,
    processComplementoGeoJSONImport
} from "@/lib/importService";
import { restrictToAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const bairroNome = formData.get("bairro") as string;
        const tipo = formData.get("tipo") as string || "IMOVEIS"; // IMOVEIS, MALHA, COMPLEMENTOS, COMPLEMENTOS_GEOJSON

        if (!file) {
            return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let result;

        switch (tipo) {
            case "COMPLEMENTOS":
                result = await processComplementoImport(buffer);
                break;
            case "COMPLEMENTOS_GEOJSON":
                result = await processComplementoGeoJSONImport(buffer);
                break;
            case "MALHA":
                result = await processGeoJSONImport(buffer);
                break;
            case "IMOVEIS":
            default:
                if (!bairroNome && tipo === "IMOVEIS") {
                    return NextResponse.json({ error: "Nome do bairro é obrigatório para importação de imóveis" }, { status: 400 });
                }
                if (file.name.endsWith('.geojson')) {
                    result = await processGeoJSONImport(buffer);
                } else {
                    result = await processExcelImport(buffer, bairroNome);
                }
                break;
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Erro na importação:", error);
        return NextResponse.json({ error: error.message || "Erro interno no servidor" }, { status: 500 });
    }
}
