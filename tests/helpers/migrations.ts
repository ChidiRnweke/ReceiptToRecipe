import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';

const MIGRATIONS_FOLDER = join(process.cwd(), 'drizzle');

interface JournalEntry {
	idx: number;
	tag: string;
}

function journal(): JournalEntry[] {
	const raw = readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8');
	const entries = (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
	return [...entries].sort((a, b) => a.idx - b.idx);
}

function statementsOf(tag: string): string[] {
	const body = readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');
	return body
		.split('--> statement-breakpoint')
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

/** The journal tag whose file name starts with `prefix`, e.g. `0012` → `0012_households`. */
export function migrationTag(prefix: string): string {
	const entry = journal().find((candidate) => candidate.tag.startsWith(prefix));
	if (!entry) throw new Error(`No migration starts with ${prefix}`);
	return entry.tag;
}

/** Runs one migration file's statements in order, inside a transaction. */
export async function applyMigration(pool: pg.Pool, tag: string): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		for (const statement of statementsOf(tag)) {
			await client.query(statement);
		}
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

/** Runs every migration in journal order up to and including the one starting with `prefix`. */
export async function applyMigrationsUpTo(pool: pg.Pool, prefix: string): Promise<void> {
	const last = migrationTag(prefix);
	for (const entry of journal()) {
		await applyMigration(pool, entry.tag);
		if (entry.tag === last) return;
	}
}
