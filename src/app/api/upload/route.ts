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

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitizar nome da pasta
        const sanitizedFolder = folder
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        const fileName = file.name;
        const filePath = `${sanitizedFolder}/${fileName}`;

        // Cliente Admin do Supabase para bypass de RLS se necessário e Storage
        const supabase = createAdminClient();

        // 1. Fazer upload para o Bucket 'fotos-imoveis'
        const { data, error } = await supabase.storage
            .from('fotos-imoveis')
            .upload(filePath, buffer, {
                contentType: file.type || 'image/webp',
                upsert: true
            });

        if (error) {
            console.error("[SUPABASE STORAGE ERROR]:", error);
            throw error;
        }

        // 2. Obter a URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('fotos-imoveis')
            .getPublicUrl(filePath);

        console.log(`[UPLOAD SUCCESS] Arquivo salvo no Supabase: ${publicUrl}`);

        return NextResponse.json({ success: true, url: publicUrl });
    } catch (error) {
        console.error("[UPLOAD ERROR]:", error);
        return NextResponse.json({ 
            error: "Falha ao salvar arquivo no Storage", 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
