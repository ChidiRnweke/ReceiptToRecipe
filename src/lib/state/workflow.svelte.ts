export class WorkflowState {
    receipts = $state(0);
    recipes = $state(0);
    shoppingItems = $state(0);

    constructor(initial: { receipts: number, recipes: number, shoppingItems: number } = { receipts: 0, recipes: 0, shoppingItems: 0 }) {
        if (initial) {
            this.sync(initial);
        }
    }

    sync(counts: { receipts: number, recipes: number, shoppingItems: number }) {
        if (!counts) return;
        this.receipts = counts.receipts;
        this.recipes = counts.recipes;
        this.shoppingItems = counts.shoppingItems;
    }

    incrementShopping() { this.shoppingItems += 1; }
    decrementShopping() { this.shoppingItems -= 1; }
}

export const workflowStore = new WorkflowState();
