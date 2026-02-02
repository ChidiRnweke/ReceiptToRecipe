import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			$models: 'src/lib/models',
			$services: 'src/lib/services',
			$controllers: 'src/lib/controllers',
			$factories: 'src/lib/factories',
			$db: 'src/lib/db',
			$components: 'src/lib/components',
			$repositories: 'src/lib/repositories'
		}
	}
};

export default config;
