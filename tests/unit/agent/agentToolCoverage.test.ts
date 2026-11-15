import { describe, it, expect } from 'vitest';
import { agentToolCoverage } from '../../../src/lib/factories/agent/agentToolCoverage';
import {
	agentToolBuilders,
	type AgentToolControllers
} from '../../../src/lib/factories/agent/agentTools';
import { TOOL_CATALOG } from '../../../src/lib/models/agent';
import { actor } from '../../fakes/tonight';

type Binding = { kind: string; tools?: readonly string[]; reason?: string };

const bindings: { method: string; binding: Binding }[] = Object.entries(agentToolCoverage).flatMap(
	([controller, methods]) =>
		Object.entries(methods as Record<string, Binding>).map(([method, binding]) => ({
			method: `${controller}.${method}`,
			binding
		}))
);

const nothing = () => {
	throw new Error('Building the tools must not touch a controller');
};
const controllers: AgentToolControllers = {
	kitchen: nothing,
	needsYou: nothing,
	plan: nothing,
	recipe: nothing,
	recipesDoor: nothing,
	shop: nothing,
	tonight: nothing,
	useItUp: nothing
};
const builders = agentToolBuilders(controllers, {
	actor,
	now: new Date('2026-11-08T10:00:00Z'),
	timeZone: 'UTC'
});

describe('the coverage map', () => {
	it('binds no tool to two methods', () => {
		const bound = bindings.flatMap(({ binding }) => binding.tools ?? []);
		expect(bound.length).toBe(new Set(bound).size);
	});

	it('binds each tool with the classification the catalog gives it', () => {
		const wrong = bindings.flatMap(({ method, binding }) =>
			(binding.tools ?? [])
				.filter(
					(tool) =>
						TOOL_CATALOG.find((entry) => entry.name === tool)?.classification !== binding.kind
				)
				.map((tool) => `${method}: ${tool}`)
		);
		expect(wrong).toEqual([]);
	});

	it('gives every excluded method a reason', () => {
		const silent = bindings.filter(
			({ binding }) => binding.kind === 'excluded' && (binding.reason ?? '').length < 15
		);
		expect(silent.map(({ method }) => method)).toEqual([]);
	});
});

describe('the tool builders', () => {
	it('build every server tool of the catalog', () => {
		const missing = TOOL_CATALOG.filter(
			(entry) => !('surface' in entry) && !(entry.name in builders)
		);
		expect(missing.map((entry) => entry.name)).toEqual([]);
	});

	it('name each tool after its key', () => {
		const misnamed = Object.entries(builders).filter(([key, tool]) => tool.name !== key);
		expect(misnamed.map(([key]) => key)).toEqual([]);
	});

	it('say which doors every change makes stale', () => {
		const silent = Object.values(builders).filter(
			(tool) => tool.classification === 'mutation' && tool.doors.length === 0
		);
		expect(silent.map((tool) => tool.name)).toEqual([]);
	});

	it('offer the model an object schema without extra properties', () => {
		const loose = Object.values(builders).filter(
			(tool) => tool.parameters.type !== 'object' || tool.parameters.additionalProperties !== false
		);
		expect(loose.map((tool) => tool.name)).toEqual([]);
	});
});
