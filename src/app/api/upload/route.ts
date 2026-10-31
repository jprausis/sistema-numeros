import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser } from "@/lib/auth";

const BUCKET = "fotos-imoveis";
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

const sanitize = (value: string) => value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .replace(/^\.+/, "");

export async function POST(req: NextRequest) {
    const { response } = await requireUser();
    if (response) return response;

    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const folder = String(formData.get("folder") || "geral");

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
        }
        if (file.type && !file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Apenas imagens são permitidas" }, { status: 400 });
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "Imagem muito grande (máx. 15 MB)" }, { status: 400 });
        }

        // Converter para Uint8Array - mais estável para o cliente Supabase em Edge/Node runtimes
        const fileData = new Uint8Array(await file.arrayBuffer());

        // Prefixo único evita sobrescrever fotos de outros imóveis com o mesmo nome de arquivo
        const uniquePrefix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const fileName = `${uniquePrefix}_${sanitize(file.name || "foto.jpg") || "foto.jpg"}`;
        const filePath = `${sanitize(folder) || "geral"}/${fileName}`;

        const supabase = createAdminClient();

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, fileData, {
                contentType: file.type || "image/jpeg",
                // O nome do arquivo é único e nunca é sobrescrito: celular e CDN podem guardar a foto por 1 ano
                cacheControl: "31536000",
                upsert: false
            });

        if (error) {
            console.error("[SUPABASE STORAGE ERROR]:", error);
            return NextResponse.json({
                error: "Erro no Supabase Storage",
                details: error.message
            }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

        return NextResponse.json({ success: true, url: publicUrl });
    } catch (error) {
        console.error("[UPLOAD CRITICAL ERROR]:", error);
        return NextResponse.json({
            error: "Falha crítica no upload",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
