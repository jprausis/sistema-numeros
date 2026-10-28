import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";
import { movimentarEstoqueSeguro } from "@/lib/estoque";
import { motivoValido } from "@/lib/motivosPendencia";

export const dynamic = "force-dynamic";

const STATUS_EXECUCAO = ["CONCLUIDO", "PENDENTE"];
// Instalações guardadas no celular sem internet chegam depois: aceita o horário do aparelho até 7 dias atrás
const ATRASO_MAXIMO_MS = 7 * 24 * 60 * 60 * 1000;

function horarioDoRegistro(valor: unknown): Date {
    const agora = Date.now();
    const t = typeof valor === "string" || typeof valor === "number" ? new Date(valor).getTime() : NaN;
    return isFinite(t) && t <= agora + 5 * 60 * 1000 && agora - t <= ATRASO_MAXIMO_MS ? new Date(Math.min(t, agora)) : new Date(agora);
}

function coordenadas(body: any): { lat: number; lon: number; precisao: number | null } | null {
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    if (body?.lat == null || body?.lon == null || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const precisao = body.precisao != null && isFinite(Number(body.precisao)) ? Number(body.precisao) : null;
    return { lat, lon, precisao };
}

export async function PATCH(req: NextRequest) {
    const { user, response } = await requireUser();
    if (response) return response;

    try {
        const body = await req.json();
        const { inscimob, status, obsPendente, fotos, complementosData, protocolo } = body;
        const motivoPendencia = motivoValido(body.motivoPendencia);
        const gps = coordenadas(body);
        const registradoEm = horarioDoRegistro(body.registradoEm);

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Inscimob e Status são obrigatórios" }, { status: 400 });
        }

        const atual = await prisma.imovel.findUnique({
            where: { inscimob },
            include: { complementos: { select: { id: true, status: true, numeroPredial: true } } }
        });
        if (!atual) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        const actualInstaladorResp = user.name || user.email || "Instalador";
        const novasFotos = Array.isArray(fotos) && fotos.length > 0;
        // Só registra data/instalador quando o status do principal muda nesta requisição
        // (trocar foto ou salvar só complementos não altera a data usada no ranking diário)
        const principalExecutado = STATUS_EXECUCAO.includes(status) && (status !== atual.status || !atual.dataExecucao);

        const imovelData: any = { status, usuarioAlt: user.email };
        if (novasFotos) imovelData.fotos = JSON.stringify(fotos);
        if (status === "PENDENTE") {
            imovelData.obsPendente = obsPendente ? String(obsPendente).trim() : null;
            imovelData.motivoPendencia = motivoPendencia;
        }
        if (status === "CONCLUIDO") {
            imovelData.obsPendente = null;
            imovelData.motivoPendencia = null;
        }
        if (principalExecutado) {
            imovelData.dataExecucao = registradoEm;
            imovelData.instaladorResp = actualInstaladorResp;
        }
        // GPS do celular no momento da foto/registro (prova de local da instalação)
        if (gps && (principalExecutado || novasFotos)) {
            imovelData.latExecucao = gps.lat;
            imovelData.lonExecucao = gps.lon;
        }

        // Apenas complementos que pertencem a este imóvel
        const idsDoImovel = new Set(atual.complementos.map(c => c.id));
        const compsValidos = Array.isArray(complementosData)
            ? complementosData.filter((comp: any) => comp?.id && comp?.status && idsDoImovel.has(comp.id))
            : [];

        const imovel = await prisma.$transaction(async (tx) => {
            // 1. Atualizar o imóvel principal
            const updated = await tx.imovel.update({
                where: { inscimob },
                data: imovelData
            });

            // 2. Atualizar os complementos (se enviados no lote)
            for (const comp of compsValidos) {
                const numeroPredial = typeof comp.numeroPredial === "string" ? comp.numeroPredial.trim() : "";
                await tx.complemento.update({
                    where: { id: comp.id },
                    data: {
                        status: comp.status,
                        ...(numeroPredial ? { numeroPredial } : {}),
                        fotos: Array.isArray(comp.fotos) && comp.fotos.length > 0 ? JSON.stringify(comp.fotos) : undefined,
                        dataExecucao: STATUS_EXECUCAO.includes(comp.status) ? registradoEm : undefined,
                        ...(gps && Array.isArray(comp.fotos) && comp.fotos.length > 0 ? { latExecucao: gps.lat, lonExecucao: gps.lon } : {}),
                        liberadoInstalacao: comp.status === "CONCLUIDO" ? true : undefined
                    }
                });
            }

            // 3. Vincular Agendamento se protocolo existir
            if (protocolo) {
                await tx.agendamento.updateMany({
                    where: { protocolo },
                    data: {
                        inscimobVinculo: inscimob,
                        ...(status === 'PENDENTE' ? { status: 'PENDENTE' } : {})
                    }
                });
            }

            return updated;
        });

        // 4. Baixa automática do estoque de algarismos (principal + complementos que mudaram para CONCLUIDO)
        await movimentarEstoqueSeguro(prisma, {
            numero: imovel.numeroAInstalar,
            statusAnterior: atual.status,
            statusNovo: imovel.status,
            referencia: inscimob,
            descricao: `imóvel Nº ${imovel.numeroAInstalar} (${inscimob})`,
            userEmail: user.email,
        });
        const compsAnteriores = new Map(atual.complementos.map(c => [c.id, c]));
        for (const comp of compsValidos) {
            const anterior = compsAnteriores.get(comp.id);
            const numeroPredial = (typeof comp.numeroPredial === "string" && comp.numeroPredial.trim()) || anterior?.numeroPredial;
            await movimentarEstoqueSeguro(prisma, {
                numero: numeroPredial,
                statusAnterior: anterior?.status,
                statusNovo: comp.status,
                referencia: comp.id,
                descricao: `complemento ${numeroPredial} do imóvel ${inscimob}`,
                userEmail: user.email,
            });
        }

        // 5. Imóvel concluído => concluir todos os agendamentos em aberto vinculados a ele
        // (funciona mesmo quando o instalador acessa o imóvel pelo mapa/busca, sem protocolo)
        if (imovel.status === 'CONCLUIDO') {
            await concluirAgendamentosDoImovel(inscimob);
        }

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "sem-email@projemix.com.br",
            action: "UPDATE_IMOVEL_LOTE",
            resource: "imovel",
            resourceId: inscimob,
            details: {
                status,
                statusAnterior: atual.status,
                obsPendente,
                motivoPendencia,
                gps,
                registradoEm: registradoEm.toISOString(),
                fotos,
                complementosData: compsValidos,
                protocolo
            },
            ...getRequestMeta(req)
        });

        // A posição da instalação também atualiza o instalador no mapa do admin
        if (gps) {
            await prisma.localizacaoInstalador.create({
                data: { userId: user.id, userNome: user.name, userEmail: user.email, lat: gps.lat, lon: gps.lon, precisao: gps.precisao, evento: "INSTALACAO", createdAt: registradoEm },
            }).catch(e => console.error("Erro ao registrar localização da instalação:", e));
        }

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel e complementos:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
