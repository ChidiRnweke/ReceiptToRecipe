import { AppFactory } from '$lib/factories';
import { basilEventsResponse } from '$lib/remote/basil/runEvents';
import type { RequestHandler } from './$types';

/** The events of one of the member's Basil runs, as server-sent events. */
export const GET: RequestHandler = ({ params, request, url, locals }) =>
	basilEventsResponse(AppFactory.getBasilController(), locals.actor, params.runId, request, url);
