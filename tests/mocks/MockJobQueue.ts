import type { IJobQueue } from '../../src/lib/services/interfaces/IJobQueue';

interface ExecutedJob {
	name?: string;
	success: boolean;
	error?: Error;
}

/**
 * Mock implementation of IJobQueue for testing
 * Executes jobs synchronously for predictable testing
 */
export class MockJobQueue implements IJobQueue {
	private executedJobs: ExecutedJob[] = [];
	private shouldExecuteSynchronously: boolean;

	constructor(executeSynchronously: boolean = true) {
		this.shouldExecuteSynchronously = executeSynchronously;
	}

	async add(job: { name?: string; run: () => Promise<void> }): Promise<void> {
		if (this.shouldExecuteSynchronously) {
			// Execute immediately for predictable tests
			try {
				await job.run();
				this.executedJobs.push({ name: job.name, success: true });
			} catch (error) {
				this.executedJobs.push({ 
					name: job.name, 
					success: false, 
					error: error instanceof Error ? error : new Error(String(error))
				});
				throw error;
			}
		} else {
			// Store for async execution simulation
			this.executedJobs.push({ name: job.name, success: true });
		}
	}

	// Test helpers
	getExecutedJobs(): ExecutedJob[] {
		return [...this.executedJobs];
	}

	getExecutedJobNames(): (string | undefined)[] {
		return this.executedJobs.map(j => j.name);
	}

	wasJobExecuted(name: string): boolean {
		return this.executedJobs.some(j => j.name === name);
	}

	getFailedJobs(): ExecutedJob[] {
		return this.executedJobs.filter(j => !j.success);
	}

	clear(): void {
		this.executedJobs = [];
	}
}
