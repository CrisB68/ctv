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
