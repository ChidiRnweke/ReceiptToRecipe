/**
 * Loads app modules from a script through Vite with the SvelteKit plugin, so `$lib`, `$services`
 * and `$env` resolve exactly as in the server. The scripts run with plain Node.
 */
import { createServer, type ViteDevServer } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import dotenv from 'dotenv';

export interface AppModules {
	load<T>(path: string): Promise<T>;
	close(): Promise<void>;
}

export async function appModules(): Promise<AppModules> {
	dotenv.config();
	const server: ViteDevServer = await createServer({
		configFile: false,
		plugins: [sveltekit()],
		appType: 'custom',
		optimizeDeps: { noDiscovery: true, include: [] },
		logLevel: 'error',
		server: { middlewareMode: true, hmr: false, ws: false }
	});
	return {
		load: async <T>(path: string) => (await server.ssrLoadModule(path)) as T,
		close: () => server.close()
	};
}

/** The value after `--name` in the arguments, or null. */
export function argument(args: string[], name: string): string | null {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? null : (args[index + 1] ?? null);
}

/** The integer after `--name`, or the fallback. */
export function integerArgument(args: string[], name: string, fallback: number): number {
	const value = argument(args, name);
	if (value === null) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} needs a whole number`);
	return parsed;
}
