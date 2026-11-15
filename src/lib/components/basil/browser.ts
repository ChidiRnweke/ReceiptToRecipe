/**
 * What the browser does for Basil: tell it about the page, carry out its client tools, and
 * refresh the doors a change touched.
 */

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { DOOR_PATH, type BasilDoor, type ClientAction, type PageContext } from '$lib/models/agent';
import { activeDoor, type DoorKey } from '$lib/components/doors/doors';
import { getAlternatives, getTonight } from '$lib/remote/tonight/tonight.remote';
import { getPlan } from '$lib/remote/plan/plan.remote';
import { getShop } from '$lib/remote/shop/shop.remote';
import { getUseItUp } from '$lib/remote/useitup/useitup.remote';
import { listMine } from '$lib/remote/recipes/recipes.remote';
import { getNeedsYou } from '$lib/remote/needsyou/needsyou.remote';
import { MY_RECIPE_TABS } from '$lib/models/recipes';
import { planRange } from '$lib/state/planRange.svelte';
import { recipeFilter } from '$lib/state/recipeFilter.svelte';

const DOOR_OF: Record<DoorKey, BasilDoor> = {
	tonight: 'tonight',
	plan: 'plan',
	shop: 'shop',
	recipes: 'recipes',
	use: 'use-it-up'
};

/** The door a path belongs to, as Basil names it. */
export function basilDoorOf(pathname: string): BasilDoor | null {
	const key = activeDoor(pathname);
	return key ? DOOR_OF[key] : null;
}

/** The page as Basil sees it: the door, the route, the keys it can point at, the selection. */
export function readPageContext(pathname: string): PageContext {
	const visibleIds = [...document.querySelectorAll<HTMLElement>('[data-basil-key]')]
		.map((element) => element.dataset.basilKey ?? '')
		.filter(Boolean)
		.slice(0, 60);
	const selection = window.getSelection()?.toString().trim().slice(0, 500);
	return {
		door: basilDoorOf(pathname),
		route: pathname.slice(0, 200),
		...(visibleIds.length ? { visibleIds } : {}),
		...(selection ? { selection } : {})
	};
}

/** Scrolls to the thing with this key and outlines it for a moment. */
export function highlight(key: string): boolean {
	const element = document.querySelector<HTMLElement>(`[data-basil-key="${CSS.escape(key)}"]`);
	if (!element) return false;
	const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
	element.classList.remove('basil-highlight');
	// Restart the animation when the same thing is pointed at twice.
	void element.offsetWidth;
	element.classList.add('basil-highlight');
	setTimeout(() => element.classList.remove('basil-highlight'), 2000);
	return true;
}

/** Highlights the key once it is on the page; a door that just opened may still be loading. */
export async function highlightWhenShown(key: string, timeoutMs = 3000): Promise<boolean> {
	const until = Date.now() + timeoutMs;
	while (Date.now() < until) {
		if (highlight(key)) return true;
		await new Promise((done) => setTimeout(done, 100));
	}
	return false;
}

/** Opens a door or a recipe. */
export async function open(door: BasilDoor | null, recipeId: string | null): Promise<void> {
	if (recipeId) await goto(resolve('/recipes/[id]', { id: recipeId }));
	else if (door) await goto(resolve(DOOR_PATH[door]));
}

/** Carries out Basil's client tools in order. Returns true when one of them left the page. */
export async function runClientActions(actions: ClientAction[]): Promise<boolean> {
	let moved = false;
	for (const action of actions) {
		if (action.tool === 'navigate_to') {
			await open(action.door, action.recipeId);
			moved = true;
		} else {
			await highlightWhenShown(action.key);
			moved = true;
		}
	}
	return moved;
}

/** Refreshes the queries of the doors a change touched; Needs you always. */
export function refreshDoors(doors: BasilDoor[]): void {
	if (doors.length === 0) return;
	getNeedsYou().refresh();
	for (const door of new Set(doors)) {
		if (door === 'tonight') {
			getTonight().refresh();
			getAlternatives().refresh();
		} else if (door === 'plan') {
			// The range the member picked on the Plan door, and the default the other doors read.
			if (planRange.picked) getPlan(planRange.picked).refresh();
			getPlan(undefined).refresh();
		} else if (door === 'shop') {
			getShop().refresh();
		} else if (door === 'use-it-up') {
			getUseItUp().refresh();
		} else if (door === 'recipes') {
			for (const tab of MY_RECIPE_TABS) listMine(recipeFilter.input(tab)).refresh();
		}
	}
}
