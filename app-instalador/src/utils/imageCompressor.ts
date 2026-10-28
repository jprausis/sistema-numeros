/**
 * Utilitário para compressão de imagens no lado do cliente.
 */
export async function compressImage(file: File | Blob, maxWidth = 1024, quality = 0.7, carimbo: string[] = []): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calcular proporções
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context not available'));

                ctx.drawImage(img, 0, 0, width, height);
                if (carimbo.length) desenharCarimbo(ctx, width, height, carimbo);

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failed'));
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}

/** Faixa escura no rodapé da foto com as linhas informadas (nº, data/hora, GPS): prova da instalação. */
function desenharCarimbo(ctx: CanvasRenderingContext2D, width: number, height: number, linhas: string[]) {
    const fonte = Math.max(14, Math.round(width / 38));
    const espaco = Math.round(fonte * 1.35);
    const margem = Math.round(fonte * 0.6);
    const altura = espaco * linhas.length + margem * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, height - altura, width, altura);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fonte}px Roboto, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    linhas.forEach((linha, i) => {
        ctx.fillText(linha, margem, height - altura + margem + i * espaco, width - margem * 2);
    });
}
