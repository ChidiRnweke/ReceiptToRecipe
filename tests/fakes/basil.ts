import { AgentService } from '../../src/lib/services/agent/AgentService';
import { agentToolbox, type AgentToolControllers } from '../../src/lib/factories/agent/agentTools';
import type { Actor } from '../../src/lib/models/household';
import type { Model } from '@openai/agents';
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
	InMemoryAgentMessageRepository,
	InMemoryAgentRunRepository,
	InMemoryAgentSessionRepository
} from './InMemoryAgentRepositories';
import { InMemoryModelProvider, ScriptedModel } from './InMemoryModelProvider';
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
 * Basil over in-memory stores: the real agent on the OpenAI Agents SDK, the real run lifecycle,
 * the real tools, and the real Plan, Tonight and Recipe controllers over the plan fakes. The
 * model is scripted, or a real one handed in.
 */
export function createBasil(
	model: Model = new ScriptedModel(),
	options: BasilOptions & { modelName?: string } = {}
) {
	const p = createPlan();
	const conversations = new InMemoryAgentConversationRepository();
	const messages = new InMemoryAgentMessageRepository();
	const sessions = new InMemoryAgentSessionRepository();
	const actions = new InMemoryAgentActionRepository();
	const models = new InMemoryModelProvider(model);
	const service = new AgentService(
		conversations,
		messages,
		sessions,
		actions,
		models,
		options.modelName ?? 'scripted'
	);
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
		sessions,
		actions,
		models,
		service,
		runs,
		bus,
		runService,
		basil,
		controllers,
		toolboxFor
	};
}

/**
 * A second Basil over the same stores, the model and the controllers: as after a restart, it
 * knows only what was stored, nothing the first one held in memory.
 */
export function createBasilOver(existing: ReturnType<typeof createBasil>, modelName = 'scripted') {
	const service = new AgentService(
		existing.conversations,
		existing.messages,
		existing.sessions,
		existing.actions,
		existing.models,
		modelName
	);
	const runService = new AgentRunService(
		existing.runs,
		new InProcessRunEventBus(),
		new ActiveRuns(),
		{
			flushMs: 0,
			graceMs: 50
		}
	);
	const basil = new BasilController(service, runService, existing.toolboxFor);
	return { service, runService, basil };
}
