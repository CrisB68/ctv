# Portal CTV — Centro de Terapias Vibracionais

Portal web para agendamento de terapias, catálogo de práticas, corpo clínico e painel administrativo.

**Stack:** React + TypeScript + Vite + Tailwind CSS + Lucide React.

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:5173

## Publicar no GitHub

1. Crie um repositório novo e vazio no GitHub (sem README/licença), por exemplo `portal-ctv`.
2. No terminal, dentro desta pasta:

```bash
git init
git add .
git commit -m "Portal CTV — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/portal-ctv.git
git push -u origin main
```

## Publicar no Netlify

### Opção A — conectado ao Git (recomendado, deploy automático a cada push)

1. Suba este projeto para o GitHub (veja seção acima).
2. Em https://app.netlify.com, clique em **Add new site → Import an existing project**.
3. Escolha o repositório `portal-ctv`.
4. O Netlify já detecta as configurações do `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Clique em **Deploy**. A cada `git push`, o site atualiza sozinho.

### Opção B — deploy manual (drag and drop, sem Git)

1. No seu computador, dentro da pasta do projeto:
   ```bash
   npm install
   npm run build
   ```
2. Isso cria a pasta `dist/`.
3. Acesse https://app.netlify.com/drop e arraste a pasta `dist` para lá.
4. O site fica no ar na hora, com uma URL tipo `nome-aleatorio.netlify.app`.

## Publicar o site (GitHub Pages) — automático

Este projeto já vem com um workflow (`.github/workflows/deploy.yml`) que builda e publica
automaticamente a cada push na branch `main`.

Depois do primeiro `git push`:

1. No GitHub, vá em **Settings → Pages**.
2. Em "Build and deployment", em **Source**, selecione **GitHub Actions**.
3. Aguarde a aba **Actions** concluir o workflow (ícone verde).
4. Seu site estará em `https://SEU_USUARIO.github.io/portal-ctv/`.

## Painel administrativo

Senha padrão: `ctv2024` — altere em `src/App.tsx` (constante `ADMIN_PASSWORD`) antes de publicar de verdade.

## Dados

Os agendamentos, terapias e terapeutas ficam salvos no `localStorage` do navegador de cada visitante.
Use a aba **Admin → Backup** para exportar/importar os dados em JSON.
