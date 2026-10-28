# App Android do Instalador

Versão Android do painel do instalador (`/instalador` do sistema web). Roda em paralelo com o sistema web:
usa **a mesma API** (`https://sistema-numeros.vercel.app`) e, portanto, a mesma base de dados, as mesmas
regras de estoque, auditoria e agendamentos.

Stack: Vite + React + [Capacitor 7](https://capacitorjs.com) (projeto nativo em `android/`).

## Como funciona

- Login com Supabase (mesmos usuários do sistema). A sessão fica salva no aparelho: depois do primeiro
  login o app abre direto no painel do instalador.
- Só entram perfis `INSTALLER`, `ADMIN` e `OPERATOR` (os mesmos que a API do instalador aceita).
- O app chama a API com `Authorization: Bearer <token do Supabase>`; o servidor aceita esse cabeçalho
  em `src/lib/auth.ts` e libera CORS para a origem do app em `src/middleware.ts`.
- Telas: mapa, agenda (filtros, WhatsApp, rota GPS), imóveis próximos pelo GPS, busca por inscrição e
  registro da instalação com foto (câmera ou galeria).

## Uso na rua

- **Sem internet** (`src/lib/fila.ts`): toda instalação é gravada primeiro no celular (IndexedDB, com as fotos)
  e enviada depois; sem conexão fica na fila e é reenviada sozinha (ao abrir o app, quando a internet volta e a
  cada minuto). O servidor recebe o horário do registro (`registradoEm`), então a data da instalação é a real.
  Agenda, imóveis do mapa e fichas abertas ficam guardados para consulta sem internet (`src/lib/cache.ts`).
- **Rascunho** (`src/lib/rascunho.ts`): o formulário do imóvel é salvo a cada alteração e volta se o app fechar.
- **Foto com prova de local**: a foto recebe carimbo com nº, data/hora e GPS; acima de 100 m do endereço
  cadastrado o app avisa e pede confirmação. O GPS vai para `latExecucao`/`lonExecucao` do imóvel.
- **Motivos de pendência** padronizados (`src/utils/motivosPendencia.ts`, mesma lista do servidor), salvos em
  `motivoPendencia` e filtráveis no admin.
- **Modo sol** (botão ☀), botões principais no rodapé e vibração ao salvar.
- **Localização**: no login, ao abrir o app, a cada 10 min com ele aberto e em cada instalação (aviso exibido
  uma vez por aparelho).

## Configuração

Copie `.env.example` para `.env` e preencha com os mesmos valores `NEXT_PUBLIC_SUPABASE_*` do sistema web.

## Desenvolvimento

```bash
npm install
npm run dev          # app no navegador usando o servidor de produção
npm run dev:teste    # app usando o sistema web local (npm run dev na raiz, porta 3000)
```

## Gerar o APK

**Pelo GitHub (sem instalar nada):** o workflow `.github/workflows/app-instalador.yml` gera o APK a cada
push em `main` que altere esta pasta (ou manualmente em Actions → "App do Instalador (APK)" → Run workflow).
Antes, cadastre em Settings → Secrets and variables → Actions os secrets `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD`. O APK fica em "Artifacts" na execução.

O APK é assinado com uma chave fixa (PKCS12, alias `instalador`, guardada fora do repositório), então cada
versão nova instala por cima da anterior. O número da execução do workflow vira o `versionCode`. Se a chave
for perdida, os celulares terão que desinstalar o app para instalar uma versão assinada com chave nova.

**No computador:** com JDK 21 e Android SDK (Android Studio) instalados:

```bash
npm run android:apk   # gera android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open  # abre o projeto no Android Studio
```

Depois de alterar o código web do app, rode `npm run android:sync` para copiar o build para o projeto Android.

## Ícone e splash

Gerados a partir de `assets/` com `npx @capacitor/assets generate --android`.
