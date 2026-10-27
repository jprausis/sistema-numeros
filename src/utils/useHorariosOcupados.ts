'use client';

import { useEffect, useState } from 'react';

export type HorarioOcupado = { protocolo: string; inscimob: string | null; horario: string };

/** Horários já ocupados no dia (YYYY-MM-DD), ignorando o próprio agendamento em edição. */
export function useHorariosOcupados(data: string, ignorarProtocolo?: string | null, ativo = true) {
    const [resultado, setResultado] = useState<{ chave: string; ocupados: HorarioOcupado[] }>({ chave: '', ocupados: [] });

    const valido = ativo && /^\d{4}-\d{2}-\d{2}$/.test(data);
    const params = new URLSearchParams({ data });
    if (ignorarProtocolo) params.set('ignorar', ignorarProtocolo);
    const chave = valido ? params.toString() : '';

    useEffect(() => {
        if (!chave) return;
        let cancelado = false;
        fetch(`/api/agendamentos/horarios?${chave}`)
            .then(res => (res.ok ? res.json() : { ocupados: [] }))
            .then(json => { if (!cancelado) setResultado({ chave, ocupados: json.ocupados || [] }); })
            .catch(() => { if (!cancelado) setResultado({ chave, ocupados: [] }); });
        return () => { cancelado = true; };
    }, [chave]);

    // Só devolve o resultado se corresponder à consulta atual
    return chave && resultado.chave === chave ? resultado.ocupados : [];
}
