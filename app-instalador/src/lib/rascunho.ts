import { apagar, gravar, ler } from './armazenamento';
import type { Posicao } from './gps';

/** Informações da foto tirada: GPS, distância até o imóvel e origem (câmera ou galeria). */
export type InfoFoto = { gps: Posicao | null; distancia: number | null; galeria: boolean };

/** Formulário de instalação em andamento, salvo no celular a cada alteração. */
export type Rascunho = {
    statusMain: 'CONCLUIDO' | 'PENDENTE';
    motivo: string;
    obs: string;
    obsInstalacao?: string; // rascunhos antigos não têm
    photoMain: Blob | null;
    photoMainInfo: InfoFoto | null;
    compPhotos: Record<string, Blob | null>;
    compInfo: Record<string, InfoFoto | null>;
    compStatuses: Record<string, 'CONCLUIDO' | 'PENDENTE'>;
    compIncluded: Record<string, boolean>;
    compNumeroPredial: Record<string, string>;
    salvoEm: number;
};

const chave = (inscimob: string) => `rascunho:${inscimob}`;

export const lerRascunho = (inscimob: string) => ler<Rascunho>('dados', chave(inscimob)).catch(() => undefined);
export const salvarRascunho = (inscimob: string, r: Rascunho) => gravar('dados', chave(inscimob), r).catch(() => {});
export const apagarRascunho = (inscimob: string) => apagar('dados', chave(inscimob)).catch(() => {});
