import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import { doorFor, type DoorKey } from '$lib/components/doors/doors';
import type { FrontDoor } from '$lib/models/tonight';

const DOOR_KEY: Record<FrontDoor, DoorKey> = {
	tonight: 'tonight',
	plan: 'plan',
	shop: 'shop',
	'use-it-up': 'use'
};

/** Signed-in members land on the door that fits the moment; visitors see the landing page. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.actor) return { user: null };

	const choice = await AppFactory.getFrontDoorController().decide(
		locals.actor,
		new Date(),
		locals.timeZone
	);
	redirect(303, doorFor(DOOR_KEY[choice.door]).href);
};
