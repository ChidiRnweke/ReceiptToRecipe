type Job = {
  name?: string;
  run: () => Promise<unknown>;
};

/**
 * Minimal in-memory job queue with bounded concurrency.
 * Intended for short background tasks like OCR or image generation.
 */
export class JobQueue {
  private queue: Job[] = [];
  private running = 0;

  constructor(private concurrency: number = 2) {}

  add(job: Job): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        name: job.name,
        run: async () => {
          try {
            await job.run();
            resolve();
          } catch (error) {
            reject(error);
            throw error;
          }
        }
      });

      this.process();
    });
  }

  private process(): void {
    if (this.running >= this.concurrency) return;
    const next = this.queue.shift();
    if (!next) return;

    this.running += 1;

    next
      .run()
      .catch((error) => {
        console.error(`Job failed${next.name ? ` [${next.name}]` : ''}:`, error);
      })
      .finally(() => {
        this.running -= 1;
        this.process();
      });
  }
}
