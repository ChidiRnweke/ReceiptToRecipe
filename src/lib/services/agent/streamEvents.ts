import type { RunItem, RunStreamEvent } from '@openai/agents';

/** A function call as the model wrote it: its id, the tool's name and the raw JSON arguments. */
export interface StreamedCall {
	callId: string;
	name: string;
	arguments: string;
}

/**
 * The agent SDK's stream events that Basil acts on. Everything else the SDK sends (the model's
 * raw chunks, reasoning, agent updates) is `ignored`, so a new SDK event cannot break a run.
 */
export type BasilStreamEvent =
	| { type: 'text'; text: string }
	| { type: 'tool_called'; call: StreamedCall }
	| { type: 'tool_output'; callId: string }
	| { type: 'approval_requested'; call: StreamedCall }
	/** The model answered with neither words nor a tool call. */
	| { type: 'empty_response' }
	| { type: 'ignored' };

/** One SDK stream event as an arm of {@link BasilStreamEvent}. */
export function readStreamEvent(event: RunStreamEvent): BasilStreamEvent {
	if (event.type === 'raw_model_stream_event') {
		const data = event.data;
		if (data.type === 'output_text_delta') return { type: 'text', text: data.delta };
		if (data.type !== 'response_done') return { type: 'ignored' };
		const answered = data.response.output.some(
			(item) => item.type === 'message' || item.type === 'function_call'
		);
		return answered ? { type: 'ignored' } : { type: 'empty_response' };
	}
	if (event.type !== 'run_item_stream_event') return { type: 'ignored' };
	switch (event.name) {
		case 'tool_called': {
			const call = functionCall(event.item);
			return call ? { type: 'tool_called', call } : { type: 'ignored' };
		}
		case 'tool_approval_requested': {
			const call = functionCall(event.item);
			return call ? { type: 'approval_requested', call } : { type: 'ignored' };
		}
		case 'tool_output':
			return event.item.type === 'tool_call_output_item' &&
				event.item.rawItem.type === 'function_call_result'
				? { type: 'tool_output', callId: event.item.rawItem.callId }
				: { type: 'ignored' };
		default:
			return { type: 'ignored' };
	}
}

/** The function call a tool-call or approval item carries; undefined for any other item. */
export function functionCall(item: RunItem): StreamedCall | undefined {
	if (item.type !== 'tool_call_item' && item.type !== 'tool_approval_item') return undefined;
	const raw = item.rawItem;
	if (raw.type !== 'function_call') return undefined;
	return { callId: raw.callId, name: raw.name, arguments: raw.arguments };
}
