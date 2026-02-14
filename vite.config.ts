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
				globPatterns: [
					'client/**/*.{js,css,ico,png,svg,webp,webmanifest}',
					'prerendered/**/*.html'
				],
				// Network-first for all navigation requests
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'ssr-pages',
							// No networkTimeoutSeconds on first navigation — prevents
							// falsely showing the offline page while the browser is still
							// fetching on a slow connection or first install.
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
							// Removing networkTimeoutSeconds ensures we don't serve stale
							// cached pages (which might have wrong auth state) while online.
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
							// No timeout for data requests prevents showing stale/conflicting
							// data (e.g. logged-out header on logged-in page) on slow connections.
							// The user will see a loading state instead.
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
				navigateFallbackDenylist: [/^\/login/, /^\/callback/, /^\/logout/, /^\/api/],
				// Only apply navigateFallback to same-origin app routes
				navigateFallbackAllowlist: [/^\/$/, /^\/(recipes|receipts|shopping|preferences|offline)/],
				skipWaiting: false,
				clientsClaim: true
			}
		})
	]
});
