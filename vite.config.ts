import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          // Divide bibliotecas grandes em arquivos proprios, separados do codigo
          // do app. Isso nao muda nenhum comportamento -- so permite que o
          // navegador baixe e guarde em cache cada biblioteca separadamente
          // (ex: o Firebase so precisa ser baixado de novo se ele mudar, nao a
          // cada pequena alteracao no codigo do site).
          manualChunks: {
            firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
