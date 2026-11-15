import { z } from 'zod';
import { BASIL_DOORS } from './doors';

/** What the person is looking at when they ask. */
export const pageContextInput = z
	.object({
		door: z.enum(BASIL_DOORS).nullable(),
		route: z.string().trim().max(200),
		/** `data-basil-key` values on the page, so Basil can point at them. */
		visibleIds: z.array(z.string().trim().min(1).max(120)).max(60).optional(),
		/** Text the person selected, if any. */
		selection: z.string().trim().max(500).optional()
	})
	.strict();
export type PageContext = z.infer<typeof pageContextInput>;
