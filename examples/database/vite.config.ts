import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
    root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
    // The page loads from file://, where an absolute asset path would point at the filesystem root.
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
        // The packages are read from their source, so a change in them needs no build.
        conditions: ['source', ...defaultClientConditions],
        // The packages resolve their dependencies from the repository root; one copy each or hooks and words break.
        dedupe: ['react', 'react-dom', 'i18next', 'react-i18next']
    },
    build: {
        outDir: fileURLToPath(new URL('./dist/renderer', import.meta.url)),
        emptyOutDir: true,
        target: 'chrome140',
        cssTarget: 'chrome140'
    }
});
