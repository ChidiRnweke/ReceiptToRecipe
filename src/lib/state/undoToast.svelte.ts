type UndoHandler = () => void | Promise<void>;

type ShowUndoToastInput = {
	message: string;
	onUndo: UndoHandler;
	label?: string;
	timeoutMs?: number;
};

class UndoToastState {
	visible = $state(false);
	message = $state('');
	actionLabel = $state('Undo');
	busy = $state(false);

	private onUndo: UndoHandler | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;

	show(input: ShowUndoToastInput) {
		this.clearTimer();
		this.visible = true;
		this.busy = false;
		this.message = input.message;
		this.actionLabel = input.label ?? 'Undo';
		this.onUndo = input.onUndo;

		const timeoutMs = input.timeoutMs ?? 5000;
		this.timer = setTimeout(() => {
			this.dismiss();
		}, timeoutMs);
	}

	async undo() {
		if (!this.onUndo || this.busy) return;
		this.busy = true;
		try {
			await this.onUndo();
		} finally {
			this.dismiss();
		}
	}

	dismiss() {
		this.clearTimer();
		this.visible = false;
		this.message = '';
		this.actionLabel = 'Undo';
		this.onUndo = null;
		this.busy = false;
	}

	private clearTimer() {
		if (!this.timer) return;
		clearTimeout(this.timer);
		this.timer = null;
	}
}

export const undoToastState = new UndoToastState();
