/**
 * What Basil may do with every controller method, decided at compile time.
 *
 * `AgentToolCoverage` has one entry per public method of every controller, so a new method
 * without a decision fails `npm run check` with a missing property, and a renamed one with an
 * excess property. A method binds the tools that represent it, or is excluded with a reason.
 */

import type {
	BasilController,
	FrontDoorController,
	HouseholdController,
	KitchenController,
	NeedsYouController,
	PlanController,
	PreferencesController,
	ReceiptController,
	RecipeController,
	RecipesDoorController,
	ShopController,
	ShoppingListController,
	TasteProfileController,
	TonightController,
	UseItUpController
} from '$controllers';
import type { AgentToolContractMap, ServerToolName, ToolName } from '$lib/models/agent';

/** Every controller of the application. */
export interface CoveredAgentControllers {
	readonly basil: BasilController;
	readonly frontDoor: FrontDoorController;
	readonly household: HouseholdController;
	readonly kitchen: KitchenController;
	readonly needsYou: NeedsYouController;
	readonly plan: PlanController;
	readonly preferences: PreferencesController;
	readonly receipt: ReceiptController;
	readonly recipe: RecipeController;
	readonly recipesDoor: RecipesDoorController;
	readonly shop: ShopController;
	readonly shoppingList: ShoppingListController;
	readonly tasteProfile: TasteProfileController;
	readonly tonight: TonightController;
	readonly useItUp: UseItUpController;
}

export type AgentToolCoverage = AgentToolContractMap<CoveredAgentControllers>;

const SETTINGS =
	'Diet, allergies and preferences are changed in settings, where the person sees the whole profile.';
const RECEIPTS = 'Receipts arrive as photos on the Shop door; Basil cannot provide a file.';
const LEGACY_LIST = 'The old shopping list page; Basil works with the Shop door’s list instead.';

export const agentToolCoverage = {
	basil: {
		getConversation: {
			kind: 'excluded',
			reason: 'Basil does not read its own conversation as a tool.'
		},
		submit: { kind: 'excluded', reason: 'Basil does not talk to itself.' },
		decide: { kind: 'excluded', reason: 'Only the person says yes or not now, on the card.' },
		cancel: { kind: 'excluded', reason: 'Only the person stops Basil, with Stop.' },
		startOver: { kind: 'excluded', reason: 'Only the person starts a new conversation.' },
		openRun: { kind: 'excluded', reason: 'The sheet’s event stream, not a household action.' },
		listEvents: { kind: 'excluded', reason: 'The sheet’s event stream, not a household action.' },
		isStreamComplete: {
			kind: 'excluded',
			reason: 'The sheet’s event stream, not a household action.'
		},
		watch: { kind: 'excluded', reason: 'The sheet’s event stream, not a household action.' },
		recoverInterruptedRuns: {
			kind: 'excluded',
			reason: 'Runs once when the server starts; nobody asks for it.'
		}
	},
	frontDoor: {
		decide: {
			kind: 'excluded',
			reason: 'Chooses the door the app opens on; Basil gets the current door in its page context.'
		}
	},
	household: {
		getOverview: {
			kind: 'excluded',
			reason: 'Members and invites are managed on the household page.'
		},
		setRoles: { kind: 'excluded', reason: 'Who plans, shops and cooks is a household setting.' },
		setTimeZone: { kind: 'excluded', reason: 'Time-zone changes are a settings action.' },
		createInvite: {
			kind: 'excluded',
			reason: 'An invite link is shared by a person, not by Basil.'
		},
		previewJoin: {
			kind: 'excluded',
			reason: 'An invite is previewed by the person invited, on the invite page they opened.'
		},
		acceptInvite: {
			kind: 'excluded',
			reason: 'Joining a household is the invited person’s choice.'
		}
	},
	kitchen: {
		getPicture: {
			kind: 'excluded',
			reason: 'kitchen_stock reads the same kitchen through Use it up, with the names people know.'
		},
		recordCooked: { kind: 'excluded', reason: 'mark_cooked records cooking through Tonight.' },
		correct: {
			kind: 'excluded',
			reason: 'mark_gone, still_good and set_amount_left make the corrections through Use it up.'
		},
		recordShopDone: {
			kind: 'excluded',
			reason: 'A shop ends on the Shop door, with its receipt or ticks.'
		},
		getHabits: { kind: 'read', tools: ['habits'] },
		answerOffer: {
			kind: 'excluded',
			reason: 'Habit offers are answered on their Needs you card, where the person sees the offer.'
		}
	},
	needsYou: {
		list: { kind: 'read', tools: ['needs_you'] },
		answer: {
			kind: 'excluded',
			reason:
				'Answers come from a card’s buttons; Basil uses the matching kitchen, plan and list tools.'
		}
	},
	plan: {
		getPlan: { kind: 'read', tools: ['get_plan'] },
		pickRange: { kind: 'excluded', reason: 'A day-strip helper that changes nothing Basil reads.' },
		suggestRest: { kind: 'mutation', tools: ['fill_plan_rest'] },
		planWholeWeek: {
			kind: 'excluded',
			reason: 'fill_plan_rest fills the open days; a whole-week fill is a button on Plan.'
		},
		ideas: { kind: 'proposal', tools: ['suggest_plan_rest'] },
		setSlot: { kind: 'mutation', tools: ['set_plan_slot'] },
		removeSlot: { kind: 'mutation', tools: ['remove_plan_slot'] },
		setServings: { kind: 'mutation', tools: ['guests_for_meal'] },
		cookForTwoDays: { kind: 'mutation', tools: ['cook_for_two_days'] },
		planBatchPrep: {
			kind: 'excluded',
			reason: 'A prep session is planned on Plan, where its boxes and days are shown.'
		},
		discover: { kind: 'excluded', reason: 'set_plan_slot puts a new recipe on a chosen day.' },
		markPrepDone: {
			kind: 'excluded',
			reason: '“Boxes in the fridge” is the prep card’s own button.'
		}
	},
	preferences: {
		getPreferences: { kind: 'excluded', reason: SETTINGS },
		updatePreferences: { kind: 'excluded', reason: SETTINGS },
		addAllergy: { kind: 'excluded', reason: SETTINGS },
		removeAllergy: { kind: 'excluded', reason: SETTINGS },
		addDietaryRestriction: { kind: 'excluded', reason: SETTINGS },
		removeDietaryRestriction: { kind: 'excluded', reason: SETTINGS },
		addExcludedIngredient: { kind: 'excluded', reason: SETTINGS },
		removeExcludedIngredient: { kind: 'excluded', reason: SETTINGS },
		setCuisinePreferences: { kind: 'excluded', reason: SETTINGS },
		setCaloricGoal: { kind: 'excluded', reason: SETTINGS },
		setDefaultServings: { kind: 'excluded', reason: SETTINGS }
	},
	receipt: {
		uploadReceipt: { kind: 'excluded', reason: 'Uploads need a file the agent can’t provide.' },
		resumePendingReceipts: {
			kind: 'excluded',
			reason: 'Startup work for every household, not one member.'
		},
		getReceipt: { kind: 'excluded', reason: RECEIPTS },
		getReceiptStatus: { kind: 'excluded', reason: RECEIPTS },
		getHouseholdReceipts: { kind: 'excluded', reason: RECEIPTS },
		deleteReceipt: { kind: 'excluded', reason: 'Deleting a receipt is done on the receipts page.' },
		updateReceiptItem: {
			kind: 'excluded',
			reason: 'Receipt lines are corrected next to the photo.'
		},
		addManualItem: { kind: 'excluded', reason: 'Receipt lines are corrected next to the photo.' },
		deleteReceiptItem: {
			kind: 'excluded',
			reason: 'Receipt lines are corrected next to the photo.'
		},
		getRecipeCountsByReceiptIds: { kind: 'excluded', reason: RECEIPTS }
	},
	recipe: {
		generateRecipe: {
			kind: 'excluded',
			reason: 'make_recipe_from_craving makes a recipe; this is the plan’s top-up path.'
		},
		getRecipe: { kind: 'read', tools: ['get_recipe'] },
		getRecipeWithServings: {
			kind: 'excluded',
			reason: 'get_recipe gives the servings to scale by.'
		},
		getHouseholdRecipes: {
			kind: 'excluded',
			reason: 'find_recipes lists the household’s recipes.'
		},
		getHouseholdRecipesWithIngredients: {
			kind: 'excluded',
			reason: 'find_recipes lists the household’s recipes.'
		},
		saveRecipe: { kind: 'mutation', tools: ['save_recipe'] },
		unsaveRecipe: { kind: 'mutation', tools: ['unsave_recipe'] },
		getSavedRecipes: { kind: 'excluded', reason: 'find_recipes with the saved tab lists them.' },
		isSaved: { kind: 'excluded', reason: 'find_recipes with the saved tab lists them.' },
		togglePublic: { kind: 'excluded', reason: 'Sharing a recipe publicly is the owner’s choice.' },
		deleteRecipe: {
			kind: 'excluded',
			reason: 'Deleting a recipe cannot be undone; it stays a tap on its page.'
		},
		getImageStatus: { kind: 'excluded', reason: 'A picture’s progress shows on the recipe page.' },
		adopt: {
			kind: 'excluded',
			reason: 'Saving, planning or cooking a shared-cookbook recipe adopts it on its own.'
		},
		fillMissingPictures: {
			kind: 'excluded',
			reason: 'A startup job for every household, not something a member asks for.'
		},
		updateRecipe: { kind: 'excluded', reason: 'A recipe is edited on its page, step by step.' },
		adjustRecipeWithAi: {
			kind: 'excluded',
			reason: 'The recipe page’s adjuster shows the change before it is kept.'
		}
	},
	recipesDoor: {
		craving: { kind: 'mutation', tools: ['make_recipe_from_craving'] },
		snap: { kind: 'excluded', reason: 'Snapping needs a photo the agent can’t provide.' },
		listMine: { kind: 'read', tools: ['find_recipes'] },
		findInCookbook: { kind: 'read', tools: ['find_cookbook_recipes'] },
		somethingNew: {
			kind: 'excluded',
			reason: 'find_cookbook_recipes searches the shared cookbook; this strip is for browsing.'
		},
		resumeTagging: {
			kind: 'excluded',
			reason: 'Startup work for every household, not one member.'
		}
	},
	shop: {
		getShop: { kind: 'read', tools: ['get_shop_list', 'why_on_list'] },
		toggleItem: { kind: 'mutation', tools: ['tick_item'] },
		addItem: { kind: 'mutation', tools: ['add_to_list'] },
		removeItem: { kind: 'mutation', tools: ['remove_from_list'] },
		restoreItem: { kind: 'excluded', reason: 'Undo belongs to the toast that offered it.' },
		gotEverything: {
			kind: 'excluded',
			reason: 'Ending a shop records purchases; the shopper does it on the Shop door.'
		},
		undoGotEverything: { kind: 'excluded', reason: 'Undo belongs to the toast that offered it.' },
		snapReceipt: { kind: 'excluded', reason: 'Uploads need a file the agent can’t provide.' },
		getReceiptResult: { kind: 'excluded', reason: RECEIPTS },
		confirmWhatCameHome: {
			kind: 'excluded',
			reason: 'The shopper confirms a receipt against the list.'
		}
	},
	shoppingList: {
		getActiveList: { kind: 'excluded', reason: LEGACY_LIST },
		addItem: { kind: 'excluded', reason: LEGACY_LIST },
		addRecipeIngredients: { kind: 'excluded', reason: LEGACY_LIST },
		addReceiptItems: { kind: 'excluded', reason: LEGACY_LIST }
	},
	tasteProfile: {
		getProfile: { kind: 'excluded', reason: SETTINGS },
		setDietType: { kind: 'excluded', reason: SETTINGS },
		addAllergy: { kind: 'excluded', reason: SETTINGS },
		removeAllergy: { kind: 'excluded', reason: SETTINGS },
		setIngredientPreference: { kind: 'excluded', reason: SETTINGS },
		removeIngredientPreference: { kind: 'excluded', reason: SETTINGS },
		setCuisinePreference: { kind: 'excluded', reason: SETTINGS },
		checkCompatibility: {
			kind: 'excluded',
			reason: 'The plan and idea tools already rank only recipes that suit everyone.'
		}
	},
	tonight: {
		getTonight: { kind: 'read', tools: ['whats_for_tonight'] },
		alternatives: { kind: 'proposal', tools: ['suggest_ideas'] },
		cook: { kind: 'mutation', tools: ['mark_cooked'] },
		pickAlternative: { kind: 'mutation', tools: ['pick_tonight'] },
		eatOut: { kind: 'mutation', tools: ['eat_out_tonight'] },
		eatIn: { kind: 'mutation', tools: ['eat_in_tonight'] }
	},
	useItUp: {
		get: { kind: 'read', tools: ['eat_first'] },
		listHome: { kind: 'read', tools: ['kitchen_stock'] },
		ideas: { kind: 'proposal', tools: ['use_up_ideas'] },
		markGone: { kind: 'mutation', tools: ['mark_gone'] },
		stillGood: { kind: 'mutation', tools: ['still_good'] },
		undoCorrection: { kind: 'excluded', reason: 'Undo belongs to the toast that offered it.' },
		addItem: { kind: 'mutation', tools: ['add_to_kitchen'] },
		setQuantity: { kind: 'mutation', tools: ['set_amount_left'] }
	}
} as const satisfies AgentToolCoverage;

type Coverage = typeof agentToolCoverage;

/**
 * Every tool name some controller method binds. `agentToolCoverage` is `as const satisfies`, so
 * each `tools` entry keeps its literals and this union is real.
 */
export type BoundToolName = {
	[C in keyof Coverage]: {
		[M in keyof Coverage[C]]: Coverage[C][M] extends { readonly tools: readonly (infer Name)[] }
			? Name
			: never;
	}[keyof Coverage[C]];
}[keyof Coverage];

/** The methods of a controller that bind a tool: the only ones a tool may call. */
export type BoundMethod<C extends keyof Coverage> = {
	[M in keyof Coverage[C]]: Coverage[C][M] extends { readonly tools: readonly ToolName[] }
		? M
		: never;
}[keyof Coverage[C]] &
	keyof CoveredAgentControllers[C];

type Total<T extends never> = T;
/** Every server tool of the catalog is bound by some controller method. Client tools run in the browser. */
export type _CoverageCoversCatalog = Total<Exclude<ServerToolName, BoundToolName>>;
/** No method binds a tool the catalog does not have. */
export type _CoverageNamesNothingElse = Total<Exclude<BoundToolName, ToolName>>;
