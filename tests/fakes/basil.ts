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
import { InMemoryAgentRunRepository } from './InMemoryAgentRepositories';
import { AgentRunService } from '../../src/lib/services/agent/runs/AgentRunService';
import { InProcessRunEventBus } from '../../src/lib/services/agent/runs/RunEventBus';
import { ActiveRuns } from '../../src/lib/services/agent/runs/ActiveRuns';
import { BasilController } from '../../src/lib/controllers/BasilController';

/** A getter for a controller the scenario does not use; calling it is a test bug. */
function unused(name: string): never {
	throw new Error(`The ${name} controller is not wired in this test`);
}

export interface BasilOptions {
	/** How often words are written to the stream; 0 by default, so tests need not wait. */
	flushMs?: number;
	/** How long a stopped run may take to wind down. */
	graceMs?: number;
}

/**
 * Basil over in-memory stores: the real loop, the real run lifecycle, the real tools, and the
 * real Plan, Tonight and Recipe controllers over the plan fakes. The model is scripted.
 */
export function createBasil(
	model: IAgentModel = new ScriptedAgentModel(),
	options: BasilOptions = {}
) {
	const p = createPlan();
	const conversations = new InMemoryAgentConversationRepository();
	const messages = new InMemoryAgentMessageRepository();
	const actions = new InMemoryAgentActionRepository();
	const service = new AgentService(conversations, messages, actions, model);
	const runs = new InMemoryAgentRunRepository(messages);
	const bus = new InProcessRunEventBus();
	const runService = new AgentRunService(runs, bus, new ActiveRuns(), {
		flushMs: options.flushMs ?? 0,
		graceMs: options.graceMs ?? 50
	});
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
	const basil = new BasilController(service, runService, toolboxFor);
	return {
		...p,
		conversations,
		messages,
		actions,
		service,
		runs,
		bus,
		runService,
		basil,
		controllers,
		toolboxFor
	};
}
