/**
 * Interface for job queue implementations
 * Allows for both real (async) and mock (synchronous) implementations
 */
export interface IJobQueue {
  /**
   * Add a job to the queue
   * @param job - Job configuration with optional name and run function
   * @returns Promise that resolves when job is complete
   */
  add(job: { name?: string; run: () => Promise<void> }): Promise<void>;
}
