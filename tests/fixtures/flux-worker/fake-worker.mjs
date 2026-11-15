// A stand-in for scripts/pictures/flux_worker.py that speaks the same JSON-lines protocol.
// It "draws" a picture by writing the prompt's text to the out file, so a test can tell which
// answer belongs to which prompt. A prompt with `fail` gets an error answer, `crash` stops the
// worker, `hang` gets no answer. A request that arrives while one is in progress gets the error
// `busy`, as two pictures at once would overrun the real worker's memory.
// FAKE_READY_DELAY_MS delays the ready line; FAKE_NEVER_READY=1 leaves it out. FAKE_PID_FILE
// gets the worker's process id, so a test can check that it stopped.
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const answer = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);
let busy = false;

function handle(request) {
	if (busy) return answer({ id: request.id, error: 'busy' });
	if (request.prompt.includes('crash')) {
		process.stderr.write('[flux-worker] out of memory\n');
		process.exit(3);
	}
	if (request.prompt.includes('hang')) return;
	if (request.prompt.includes('fail')) return answer({ id: request.id, error: 'prompt refused' });
	busy = true;
	setTimeout(() => {
		writeFileSync(request.out, request.prompt);
		busy = false;
		answer({ id: request.id, path: request.out, seconds: 0.02 });
	}, 20);
}

if (process.env.FAKE_PID_FILE) writeFileSync(process.env.FAKE_PID_FILE, String(process.pid));
process.stderr.write('[flux-worker] loading fake model\n');
if (process.env.FAKE_NEVER_READY !== '1') {
	setTimeout(
		() => answer({ ready: true, model: 'fake' }),
		Number(process.env.FAKE_READY_DELAY_MS ?? 0)
	);
}
createInterface({ input: process.stdin }).on('line', (line) => {
	if (line.trim()) handle(JSON.parse(line));
});
