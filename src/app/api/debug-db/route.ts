import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const count = await prisma.imovel.count();
        const first = await prisma.imovel.findFirst();
        return NextResponse.json({ count, first });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
