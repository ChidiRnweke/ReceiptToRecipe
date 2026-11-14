import type { StockItem } from '$lib/models/kitchen';
import { sameItem } from '../tonight/items';

/** The note on an item added by hand that the kitchen says is at home. */
export const AT_HOME_NOTE = 'You might still have some at home';

/**
 * True when the kitchen holds good stock of the item: stock with the same item key that is not
 * off. Only items a person adds by hand need this; the plan and the usuals skip what is home.
 */
export function mayHaveAtHome(itemKey: string, stock: StockItem[]): boolean {
	return stock.some((item) => !item.off && item.quantity > 0 && sameItem(item.itemKey, itemKey));
}
