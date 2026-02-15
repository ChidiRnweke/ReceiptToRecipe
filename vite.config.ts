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
			// Auto-update ensures the new SW activates immediately.
			// In standalone PWA mode (no tab close), 'prompt' would leave the
			// old SW running indefinitely. Auto-update avoids stale cache issues.
			registerType: 'autoUpdate',
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
				globPatterns: [
					'client/**/*.{js,css,ico,png,svg,webp,webmanifest}',
					'prerendered/**/*.html'
				],
				// Exclude user-uploaded images from precache (they bloat the SW
				// install and are deployment-specific)
				globIgnores: ['**/uploads/**'],
				// Network-first for all navigation requests
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'ssr-pages',
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
						// Cache Google Fonts CSS
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'google-fonts-stylesheets',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 24 * 60 * 60 // 60 days
							}
						}
					},
					{
						// Cache Google Fonts woff2 files
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-webfonts',
							expiration: {
								maxEntries: 30,
								maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
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
				// Do NOT use navigateFallback. With SvelteKit SSR, the
				// NavigationRoute it creates takes priority over our NetworkFirst
				// handler and serves the offline page even when the network is
				// available -- causing the blank/unstyled page flash on refresh.
				// Instead, the NetworkFirst handler will naturally fall back to
				// cached pages when offline.
				navigateFallback: null,
				skipWaiting: true,
				clientsClaim: true
			}
		})
	]
});
