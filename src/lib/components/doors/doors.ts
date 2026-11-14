import { BookOpen, CalendarDays, Moon, Recycle, ShoppingBasket } from 'lucide-svelte';

export type DoorKey = 'tonight' | 'plan' | 'shop' | 'recipes' | 'use';

/** Routes the doors open today; each door PR moves its own entry. */
export type DoorHref = '/tonight' | '/plan' | '/shopping' | '/recipes' | '/cupboard';

export interface Door {
	key: DoorKey;
	label: string;
	href: DoorHref;
	icon: typeof Moon;
	matches: (pathname: string) => boolean;
}

const at =
	(base: string) =>
	(pathname: string): boolean =>
		pathname === base || pathname.startsWith(`${base}/`);

/** The five doors, always shown, always in this order. */
export const DOORS: readonly Door[] = [
	{
		key: 'tonight',
		label: 'Tonight',
		href: '/tonight',
		icon: Moon,
		matches: (p) => p === '/' || at('/tonight')(p)
	},
	{ key: 'plan', label: 'Plan', href: '/plan', icon: CalendarDays, matches: at('/plan') },
	{ key: 'shop', label: 'Shop', href: '/shopping', icon: ShoppingBasket, matches: at('/shopping') },
	{ key: 'recipes', label: 'Recipes', href: '/recipes', icon: BookOpen, matches: at('/recipes') },
	{ key: 'use', label: 'Use it up', href: '/cupboard', icon: Recycle, matches: at('/cupboard') }
];

export function doorFor(key: DoorKey): Door {
	const door = DOORS.find((d) => d.key === key);
	if (!door) throw new Error(`Unknown door ${key}`);
	return door;
}

export function activeDoor(pathname: string): DoorKey | null {
	return DOORS.find((door) => door.matches(pathname))?.key ?? null;
}
