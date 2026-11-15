import { AgentService } from '../../src/lib/services/agent/AgentService';
import { agentToolbox, type AgentToolControllers } from '../../src/lib/factories/agent/agentTools';
import type { Actor } from '../../src/lib/models/household';
import type { IAgentModel } from '../../src/lib/services/interfaces/IAgentModel';
import { RecipeController } from '../../src/lib/controllers/RecipeController';
import { RecipeBookService } from '../../src/lib/services/RecipeBookService';
import {
	MockCulinaryIntelligence,
	MockImageGenerator,
	MockJobQueue,
	MockReceiptItemRepository,
	MockVectorService
} from '../mocks';
import { InMemoryRecipeStepRepository } from './InMemoryRecipeStepRepository';
import { createPlan } from './plan';
import {
	InMemoryAgentActionRepository,
	InMemoryAgentConversationRepository,
	InMemoryAgentMessageRepository
} from './InMemoryAgentRepositories';
import { ScriptedAgentModel } from './ScriptedAgentModel';

/** A getter for a controller the scenario does not use; calling it is a test bug. */
function unused(name: string): never {
	throw new Error(`The ${name} controller is not wired in this test`);
}

/**
 * Basil over in-memory stores: the real loop, the real tools, and the real Plan, Tonight and
 * Recipe controllers over the plan fakes. The model is scripted.
 */
export function createBasil(model: IAgentModel = new ScriptedAgentModel()) {
	const p = createPlan();
	const conversations = new InMemoryAgentConversationRepository();
	const messages = new InMemoryAgentMessageRepository();
	const actions = new InMemoryAgentActionRepository();
	const service = new AgentService(conversations, messages, actions, model);
	const recipeController = new RecipeController(
		new MockCulinaryIntelligence(),
		new MockVectorService(),
		p.taste,
		p.recipes,
		p.ingredients,
		p.saved,
		p.preferences,
		new MockReceiptItemRepository(),
		new RecipeBookService(
			p.recipes,
			p.ingredients,
			new InMemoryRecipeStepRepository(),
			new MockImageGenerator(),
			new MockJobQueue()
		)
	);
	const controllers: AgentToolControllers = {
		plan: () => p.planController,
		tonight: () => p.controller,
		kitchen: () => unused('kitchen'),
		needsYou: () => unused('needsYou'),
		recipe: () => recipeController,
		recipesDoor: () => unused('recipesDoor'),
		shop: () => unused('shop'),
		useItUp: () => unused('useItUp')
	};
	const toolboxFor = (actor: Actor, now: Date, timeZone = 'UTC') =>
		agentToolbox(controllers, { actor, now, timeZone });
	return { ...p, conversations, messages, actions, service, controllers, toolboxFor };
}
