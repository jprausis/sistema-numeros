import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const folder = formData.get("folder") as string || "geral";

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
        }

        // Converter para Uint8Array - mais estável para o cliente Supabase em Edge/Node runtimes
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        // Sanitizar nome da pasta
        const sanitizedFolder = folder
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        const fileName = file.name;
        // Remover barras extras se houver
        const filePath = `${sanitizedFolder.replace(/^\//, '')}/${fileName}`;

        console.log(`[UPLOAD DEBUG] Iniciando upload para: fotos-imoveis -> ${filePath}`);
        
        // Cliente Admin do Supabase
        const supabase = createAdminClient();

        // 1. Fazer upload para o Bucket 'fotos-imoveis'
        const { data, error } = await supabase.storage
            .from('fotos-imoveis')
            .upload(filePath, fileData, {
                contentType: file.type || 'image/webp',
                upsert: true
            });

        if (error) {
            console.error("[SUPABASE STORAGE ERROR]:", error);
            return NextResponse.json({ 
                error: "Erro no Supabase Storage", 
                details: error.message || JSON.stringify(error) 
            }, { status: 500 });
        }

        console.log(`[UPLOAD DEBUG] Sucesso no upload. Dados retornados:`, data);

        // 2. Obter a URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('fotos-imoveis')
            .getPublicUrl(filePath);

        console.log(`[UPLOAD SUCCESS] URL Pública: ${publicUrl}`);

        return NextResponse.json({ success: true, url: publicUrl });
    } catch (error) {
        console.error("[UPLOAD CRITICAL ERROR]:", error);
        return NextResponse.json({ 
            error: "Falha crítica no upload", 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
