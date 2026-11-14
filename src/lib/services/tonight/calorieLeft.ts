/**
 * Calories left today for a member with a daily goal, never below zero. Null without a goal.
 * Protein is not stored, so only calories are counted.
 */
export function calorieLeft(goal: number | null | undefined, eatenToday: number): number | null {
	if (goal === null || goal === undefined || goal <= 0) return null;
	return Math.max(0, Math.round(goal - eatenToday));
}
