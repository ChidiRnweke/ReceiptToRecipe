import type { PlanGap } from '$lib/models/plan';

/** Dinner is about this share of a day's calorie goal. */
export const DINNER_SHARE = 0.35;

const USE_WEIGHT = 3;
const MISSING_WEIGHT = 1.3;
/** Points lost per 100 kcal away from the calorie target. */
const CALORIE_WEIGHT = 0.5;

/** A recipe that can fill a gap, with what `rankIdeas` found it uses and lacks. */
export interface PlanCandidate {
	id: string;
	calories: number | null;
	/** Perishables in the kitchen that go off soon. */
	uses: string[];
	/** Ingredients the kitchen does not have enough of. */
	missing: string[];
}

export interface PickConstraints {
	/** Calories one meal should come close to, or null when nobody counts them. */
	calorieTarget: number | null;
	/** Recipes already planned in the range; they are not picked again. */
	alreadyPlanned: string[];
}

export interface GapPick {
	gap: PlanGap;
	recipeId: string;
}

function score(candidate: PlanCandidate, calorieTarget: number | null): number {
	const distance =
		calorieTarget !== null && candidate.calories !== null
			? (Math.abs(candidate.calories - calorieTarget) / 100) * CALORIE_WEIGHT
			: 0;
	return candidate.uses.length * USE_WEIGHT - candidate.missing.length * MISSING_WEIGHT - distance;
}

/**
 * Fills the gaps in order with the best candidate not yet in the range: three points per
 * perishable it uses before it goes off, minus 1.3 per missing ingredient, minus half a point
 * per 100 kcal away from the calorie target. Candidates keep their given order on a tie. A
 * recipe fills one gap at most, so the range has no repeats; gaps beyond the candidates stay
 * open.
 */
export function pickForGaps(
	candidates: PlanCandidate[],
	gaps: PlanGap[],
	constraints: PickConstraints
): GapPick[] {
	const taken = new Set(constraints.alreadyPlanned);
	const ordered = candidates
		.map((candidate, index) => ({
			candidate,
			index,
			score: score(candidate, constraints.calorieTarget)
		}))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ candidate }) => candidate);

	const picks: GapPick[] = [];
	for (const gap of gaps) {
		const next = ordered.find((candidate) => !taken.has(candidate.id));
		if (!next) break;
		taken.add(next.id);
		picks.push({ gap, recipeId: next.id });
	}
	return picks;
}
