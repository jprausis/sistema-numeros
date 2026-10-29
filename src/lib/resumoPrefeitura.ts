import prisma from "@/lib/prisma";
import { buscarPendentesProducao } from "@/lib/estoque";
import { sincronizarAgendamentosConcluidos } from "@/lib/agendamentos";
import { buildBrazilDate, splitBrazilDate, todayBrazil } from "@/lib/timezone";
import { temFotosReais } from "@/utils/fotos";
import { CARACTERES, Caractere, contagemVazia, contarCaracteres, itemDoCaractere, totalContagem } from "@/utils/estoque";

const DIAS_EVOLUCAO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
const STATUS_IMOVEL = ["CONCLUIDO", "AGENDADO", "LIBERADO", "PENDENTE", "AUSENTE", "NAO_INICIADO"] as const;

type PorStatus = Record<typeof STATUS_IMOVEL[number], number>;
const porStatusVazio = (): PorStatus => Object.fromEntries(STATUS_IMOVEL.map(s => [s, 0])) as PorStatus;

/**
 * Resumo somente leitura para o painel da prefeitura:
 * andamento geral e por bairro, evolução diária, agendamentos e estoque de números.
 * Não expõe dados pessoais de moradores nem nomes da equipe.
 */
export async function gerarResumoPrefeitura() {
    await sincronizarAgendamentosConcluidos();

    const hoje = todayBrazil();
    const inicioHoje = buildBrazilDate(hoje, "00:00")!;
    const inicioEvolucao = new Date(inicioHoje.getTime() - (DIAS_EVOLUCAO - 1) * DIA_MS);
    const agora = new Date();

    const [bairros, imoveis, complementos, agendamentos, itensEstoque, pendentesProducao, consumo] = await Promise.all([
        prisma.bairro.findMany({ where: { status: { not: "ARQUIVADO" } }, select: { id: true, nome: true, status: true }, orderBy: { nome: "asc" } }),
        prisma.imovel.findMany({
            where: { bairro: { status: { not: "ARQUIVADO" } } },
            select: { status: true, bairroId: true, dataExecucao: true, motivoPendencia: true, numeroAInstalar: true }
        }),
        prisma.complemento.findMany({
            where: { imovel: { bairro: { status: { not: "ARQUIVADO" } } } },
            select: { status: true, fotos: true, dataExecucao: true, numeroPredial: true, imovel: { select: { bairroId: true } } }
        }),
        // Somente agendamentos oficiais (PREF- ou vinculados a um imóvel), como na fila do admin
        prisma.agendamento.findMany({
            where: { OR: [{ protocolo: { startsWith: "PREF-" } }, { inscimobVinculo: { not: null } }] },
            select: { status: true, dataHora: true }
        }),
        prisma.estoqueItem.findMany(),
        buscarPendentesProducao(),
        prisma.estoqueMovimento.groupBy({
            by: ["caractere"],
            where: { tipo: { in: ["INSTALACAO", "ESTORNO", "CORRECAO"] }, createdAt: { gte: inicioEvolucao } },
            _sum: { quantidade: true }
        })
    ]);

    // Cada algarismo é instalado um a um: conta as peças do número (0-9, C e S)
    const algarismos = (numero: string | null | undefined) => totalContagem(contarCaracteres(numero));

    // Evolução diária (imóveis concluídos + complementos instalados)
    const evolucaoMap = new Map<string, { imoveis: number; complementos: number; algarismos: number }>();
    for (let i = 0; i < DIAS_EVOLUCAO; i++) {
        evolucaoMap.set(splitBrazilDate(new Date(inicioEvolucao.getTime() + i * DIA_MS)).data, { imoveis: 0, complementos: 0, algarismos: 0 });
    }
    const diaDe = (d: Date | null) => d && d >= inicioEvolucao ? evolucaoMap.get(splitBrazilDate(d).data) : undefined;

    // Andamento por bairro
    // Bairro "concluído": marcado pelo admin (mesmo com imóveis que não serão instalados) ou 100% instalado
    const porBairro = new Map(bairros.map(b => [b.id, {
        ...porStatusVazio(),
        total: 0,
        complementos: 0,
        complementosInstalados: 0,
        algarismosInstalados: 0,
        ultimaInstalacao: null as Date | null,
        marcadoConcluido: b.status === "CONCLUIDO",
    }]));
    const geral = porStatusVazio();
    let algarismosImoveis = 0;
    let restantes = 0;
    const motivos = new Map<string, number>();

    for (const im of imoveis) {
        const b = porBairro.get(im.bairroId);
        if (!b) continue;
        const status = (STATUS_IMOVEL as readonly string[]).includes(im.status) ? im.status as keyof PorStatus : "NAO_INICIADO";
        b[status]++;
        b.total++;
        geral[status]++;
        if (status !== "CONCLUIDO" && !b.marcadoConcluido) restantes++;
        if (status === "CONCLUIDO") {
            const qtd = algarismos(im.numeroAInstalar);
            b.algarismosInstalados += qtd;
            algarismosImoveis += qtd;
            const dia = diaDe(im.dataExecucao);
            if (dia) { dia.imoveis++; dia.algarismos += qtd; }
            if (im.dataExecucao && (!b.ultimaInstalacao || im.dataExecucao > b.ultimaInstalacao)) b.ultimaInstalacao = im.dataExecucao;
        }
        if (status === "PENDENTE" || status === "AUSENTE") {
            const motivo = im.motivoPendencia || (status === "AUSENTE" ? "Morador ausente" : "Não informado");
            motivos.set(motivo, (motivos.get(motivo) || 0) + 1);
        }
    }

    let complementosInstalados = 0;
    let algarismosComplementos = 0;
    for (const c of complementos) {
        const b = porBairro.get(c.imovel.bairroId);
        if (!b) continue;
        b.complementos++;
        // Mesmo critério do dashboard: complemento só conta como instalado com foto
        if (c.status === "CONCLUIDO" && temFotosReais(c.fotos)) {
            const qtd = algarismos(c.numeroPredial);
            b.complementosInstalados++;
            b.algarismosInstalados += qtd;
            complementosInstalados++;
            algarismosComplementos += qtd;
            const dia = diaDe(c.dataExecucao);
            if (dia) { dia.complementos++; dia.algarismos += qtd; }
        }
    }

    const concluido = (d: { marcadoConcluido: boolean; total: number; CONCLUIDO: number }) =>
        d.marcadoConcluido || (d.total > 0 && d.CONCLUIDO === d.total);

    const evolucao = Array.from(evolucaoMap, ([data, v]) => ({ data, ...v }));
    const diasTrabalhados = evolucao.filter(d => d.imoveis > 0).length;
    const instaladosPeriodo = evolucao.reduce((s, d) => s + d.imoveis, 0);
    const mediaPorDiaTrabalhado = diasTrabalhados ? instaladosPeriodo / diasTrabalhados : 0;
    const inicioSemana = splitBrazilDate(new Date(inicioHoje.getTime() - 6 * DIA_MS)).data;

    // Agendamentos
    const fimHoje = new Date(inicioHoje.getTime() + DIA_MS);
    const proximosDias = Array.from({ length: 7 }, (_, i) => ({
        data: splitBrazilDate(new Date(inicioHoje.getTime() + i * DIA_MS)).data,
        total: 0,
    }));
    const ag = { abertos: 0, hoje: 0, proximos7: 0, atrasados: 0, semData: 0, concluidos: 0, cancelados: 0, reagendar: 0, total: agendamentos.length };
    for (const a of agendamentos) {
        if (a.status === "CONCLUIDO") { ag.concluidos++; continue; }
        if (a.status === "CANCELADO") { ag.cancelados++; continue; }
        ag.abertos++;
        if (a.status === "REAGENDAR") ag.reagendar++;
        if (!a.dataHora) { ag.semData++; continue; }
        if (a.dataHora < agora) ag.atrasados++;
        if (a.dataHora >= inicioHoje && a.dataHora < fimHoje) ag.hoje++;
        const dia = proximosDias.find(d => d.data === splitBrazilDate(a.dataHora!).data);
        if (dia && a.dataHora >= agora) { dia.total++; ag.proximos7++; }
    }

    // Estoque de algarismos x previsão para os imóveis já liberados
    const estoque = contagemVazia();
    for (const item of itensEstoque) {
        const chave = item.caractere in estoque ? item.caractere as Caractere : itemDoCaractere(item.caractere);
        if (chave) estoque[chave] += item.quantidade;
    }
    const necessario = contagemVazia();
    for (const im of pendentesProducao.imoveis) contarCaracteres(im.numeroAInstalar, necessario);
    for (const c of pendentesProducao.complementos) contarCaracteres(c.numeroPredial, necessario);
    const consumo30d = contagemVazia();
    for (const row of consumo) {
        const chave = row.caractere in consumo30d ? row.caractere as Caractere : itemDoCaractere(row.caractere);
        if (chave) consumo30d[chave] += -(row._sum.quantidade || 0);
    }
    const totalEstoque = totalContagem(estoque);
    const consumoDia = totalContagem(consumo30d) / DIAS_EVOLUCAO;

    return {
        geradoEm: agora,
        geral: {
            totalImoveis: imoveis.length,
            porStatus: geral,
            restantes,
            totalComplementos: complementos.length,
            complementosInstalados,
            algarismosInstalados: algarismosImoveis + algarismosComplementos,
            algarismosImoveis,
            algarismosComplementos,
            bairros: bairros.length,
            bairrosConcluidos: bairros.filter(b => concluido(porBairro.get(b.id)!)).length,
        },
        ritmo: {
            hoje: evolucaoMap.get(hoje)?.imoveis || 0,
            semana: evolucao.filter(d => d.data >= inicioSemana).reduce((s, d) => s + d.imoveis, 0),
            algarismosSemana: evolucao.filter(d => d.data >= inicioSemana).reduce((s, d) => s + d.algarismos, 0),
            algarismosPeriodo: evolucao.reduce((s, d) => s + d.algarismos, 0),
            periodo: instaladosPeriodo,
            diasPeriodo: DIAS_EVOLUCAO,
            diasTrabalhados,
            mediaPorDiaTrabalhado,
            diasRestantesEstimados: mediaPorDiaTrabalhado > 0 ? Math.ceil(restantes / mediaPorDiaTrabalhado) : null,
        },
        evolucao,
        porBairro: bairros
            .map(b => {
                const d = porBairro.get(b.id)!;
                return { id: b.id, nome: b.nome, ...d, concluido: concluido(d) };
            })
            .filter(b => b.total > 0),
        motivosPendencia: Array.from(motivos, ([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total),
        agendamentos: { ...ag, proximosDias },
        estoque: {
            itens: CARACTERES.map(c => ({
                caractere: c,
                estoque: estoque[c],
                necessario: necessario[c],
                falta: Math.max(0, necessario[c] - estoque[c]),
            })),
            total: totalEstoque,
            necessario: totalContagem(necessario),
            falta: CARACTERES.reduce((s, c) => s + Math.max(0, necessario[c] - estoque[c]), 0),
            imoveisAguardando: pendentesProducao.imoveis.length,
            complementosAguardando: pendentesProducao.complementos.length,
            consumo30d: totalContagem(consumo30d),
            coberturaDias: consumoDia > 0 ? Math.floor(totalEstoque / consumoDia) : null,
        },
    };
}
