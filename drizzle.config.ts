import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: process.env.DATABASE_URL || 'postgresql://r2r:r2r@localhost:5432/r2r'
	},
	verbose: true,
	strict: true
});
