import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'resources/css/menu.css',
                'resources/js/menu.ts',
                'resources/css/game.css',
                'resources/js/game/main.ts',
                'resources/css/strategy.css',
                'resources/js/game/strategy.ts',
                'resources/css/hand-value.css',
                'resources/js/game/hand-value.ts',
            ],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        host: '0.0.0.0', // reachable from the browser when Vite runs in the node container
        port: 5173,
        strictPort: true,
        hmr: {
            host: 'localhost',
        },
        watch: {
            usePolling: true, // reliable file watching across the Docker bind mount
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
