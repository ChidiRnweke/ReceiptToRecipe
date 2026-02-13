import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: 'src',
			mode: 'production',
			strategies: 'generateSW',
			registerType: 'prompt', // User-controlled updates
			manifest: {
				name: 'ReceiptToRecipe',
				short_name: 'R2R',
				description: 'Turn receipts into recipes with AI',
				start_url: '/',
				display: 'standalone',
				background_color: '#FDFBF7',
				theme_color: '#2D3748',
				icons: [
					{
						src: '/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,webmanifest}', 'prerendered/**/*.html'],
				// Network-first for all navigation requests
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'ssr-pages',
							networkTimeoutSeconds: 3,
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: /\/(recipes|receipts|shopping|settings)\/.*/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'app-pages',
							networkTimeoutSeconds: 3,
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
							}
						}
					},
					{
						urlPattern: /\/__data\.json$/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'page-data',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 24 * 60 * 60 // 1 day
							}
						}
					},
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'images',
							expiration: {
								maxEntries: 200,
								maxAgeSeconds: 60 * 24 * 60 * 60 // 60 days
							}
						}
					}
				],
				navigateFallback: '/offline',
				navigateFallbackDenylist: [
					/^\/login/,
					/^\/callback/,
					/^\/logout/,
					/^\/api/
				],
				// Don't cache auth-related requests
				skipWaiting: false,
				clientsClaim: true
			}
		})
	]
});
