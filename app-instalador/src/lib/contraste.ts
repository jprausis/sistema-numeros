/** "Modo sol": letras maiores e mais contraste para ler a tela na rua. Preferência salva no celular. */
const CHAVE = 'modoSol';

export function contrasteAlto(): boolean {
    try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

export function aplicarContraste(ativo = contrasteAlto()) {
    if (ativo) document.documentElement.dataset.contraste = 'alto';
    else delete document.documentElement.dataset.contraste;
}

export function alternarContraste(): boolean {
    const ativo = !contrasteAlto();
    try { localStorage.setItem(CHAVE, ativo ? '1' : '0'); } catch { /* sem armazenamento: vale só nesta sessão */ }
    aplicarContraste(ativo);
    return ativo;
}
