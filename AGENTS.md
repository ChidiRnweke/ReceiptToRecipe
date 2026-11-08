# Receipt2Recipe

SvelteKit app that turns grocery receipts into pantry tracking, recipes, meal plans and shopping
lists.

- **Language**: TypeScript
- **Package manager**: npm (`package-lock.json`)
- **Database**: Postgres with pgvector through Drizzle (`src/lib/db/schema.ts`, migrations in
  `drizzle/`)

## How changes land

Never work on the main checkout or directly on `master`. Every task gets its own linked worktree
on a task branch:

```bash
git fetch origin
git worktree add artifacts/worktrees/<task-slug> -b <type>/<task-slug> origin/master
cd artifacts/worktrees/<task-slug> && npm install
```

Worktrees live under `artifacts/worktrees/`, which is ignored. A worktree starts without `.env`;
copy `.env.example` before running anything that loads environment variables.

- One PR per coherent task. Commit conventionally, push the branch, and open the PR with
  `gh pr create --head <branch> --title "<type(scope): subject>" --body-file <file>`.
- Run the gates locally before pushing: `npm run lint`, `npm run check`, `npm test`. Tests that
  need Postgres use the dev compose stack: `docker compose -f docker-compose-dev.yml up -d postgres`
  (one shared container for all worktrees).
- A schema change is a Drizzle migration: edit `src/lib/db/schema.ts`, then
  `npm run db:generate -- --name <change>` and commit `drizzle/`.
- Address review by committing, or by rebasing and pushing with `--force-with-lease`.
- Each agent owns its worktree and branch. Do not edit, reset, or delete another worktree or its
  branch, and never push to `master`.
- Remove your worktree (`git worktree remove`) and delete the branch once the PR is merged or the
  task is abandoned.

## Commits and PRs

Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): a type
(`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `style`, `revert`), an
optional scope, then a lowercase subject. Use `!` or a `BREAKING CHANGE:` footer for breaking
changes.

Use the `drafting-prs` skill for every PR body. Report only checks that actually ran. Use the
`reviewing-code` skill to review a diff, and the `qa` skill to write or audit tests.
