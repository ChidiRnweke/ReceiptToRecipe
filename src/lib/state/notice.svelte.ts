/** A short message shown for a few seconds after an action, with nothing to undo. */
class NoticeState {
	message = $state<string | null>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;

	show(message: string, timeoutMs = 4800) {
		if (this.timer) clearTimeout(this.timer);
		this.message = message;
		this.timer = setTimeout(() => this.dismiss(), timeoutMs);
	}

	dismiss() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.message = null;
	}
}

export const notice = new NoticeState();
