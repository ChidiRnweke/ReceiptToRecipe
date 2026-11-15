/**
 * The `data-basil-key` of things on the doors, which Basil's highlight tool points at. The doors
 * set them and the read tools hand them to the model, so both build them here.
 */
export const basilKey = {
	tonightCard: () => 'tonight-card',
	planSlot: (day: number, mealType: string) => `plan-slot:${day}:${mealType}`,
	shopGroup: (plannedMealId: string) => `shop-group:${plannedMealId}`,
	shopManual: () => 'shop-manual',
	shopUsuals: () => 'shop-usuals',
	kitchenItem: (itemKey: string) => `kitchen-item:${itemKey.replace(/[^A-Za-z0-9 _-]/g, '-')}`
};
