import type {
	IImageGenerator,
	GeneratedImage
} from '../../src/lib/services/interfaces/IImageGenerator';

/**
 * Stand-in for IImageGenerator: answers every prompt with a tiny PNG as a data URL, as the
 * image model does, and keeps the prompts it was given.
 */
export class MockImageGenerator implements IImageGenerator {
	/** A 1×1 PNG. */
	static readonly PNG_DATA_URL =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

	readonly prompts: string[] = [];
	/** The seed asked for with each prompt, or undefined when none was. */
	readonly seeds: (number | undefined)[] = [];
	/** Set to make the next calls fail, as an unreachable image model does. */
	failWith: Error | null = null;

	async generateImage(prompt: string, options: { seed?: number } = {}): Promise<GeneratedImage> {
		this.prompts.push(prompt);
		this.seeds.push(options.seed);
		if (this.failWith) throw this.failWith;
		return { url: MockImageGenerator.PNG_DATA_URL };
	}

	getCallCount(): number {
		return this.prompts.length;
	}
}
