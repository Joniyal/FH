/**
 * 120Hz Frame Drop & Performance Profiler
 * 
 * At 120Hz, the frame budget is 8.33 milliseconds per frame.
 * This telemetry utility monitors rendering times, detects micro-stutters,
 * and tracks main-thread stalls across components.
 */

const BUDGET_120HZ_MS = 8.33;
const BUDGET_60HZ_MS = 16.67;

export interface FrameStats {
  totalFrames: number;
  jank120HzFrames: number;
  jank60HzFrames: number;
  maxFrameDurationMs: number;
  averageFrameDurationMs: number;
}

/**
 * Measure synchronous execution time of a critical block.
 * Warns if the operation exceeds the 8.33ms 120Hz frame budget.
 */
export function measureSync<T>(tag: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  if (duration > BUDGET_120HZ_MS) {
    const isSevere = duration > BUDGET_60HZ_MS;
    const prefix = isSevere ? '🔴 [60Hz Jank]' : '🟡 [120Hz Jank]';
    console.warn(
      `${prefix} "${tag}" took ${duration.toFixed(2)}ms (Budget: ${BUDGET_120HZ_MS}ms)`
    );
  }

  return result;
}

/**
 * Measure asynchronous execution time of a pipeline.
 * Flags bottlenecks that could starve the React Native JavaScript thread.
 */
export async function measureAsync<T>(tag: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (duration > BUDGET_120HZ_MS) {
    console.log(
      `⏱️ [Async Profile: ${tag}] completed in ${duration.toFixed(2)}ms`
    );
  }

  return result;
}

/**
 * Real-time frame loop tracker that monitors continuous vsync intervals.
 * Detects missed frames and computes frame smoothness score.
 */
export class FrameRateMonitor {
  private isRunning = false;
  private animFrameId: number | null = null;
  private lastTimestamp = 0;
  private stats: FrameStats = {
    totalFrames: 0,
    jank120HzFrames: 0,
    jank60HzFrames: 0,
    maxFrameDurationMs: 0,
    averageFrameDurationMs: 0,
  };
  private totalDuration = 0;

  start(tag: string = 'Screen') {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;

      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      if (delta > 0 && delta < 500) {
        this.stats.totalFrames++;
        this.totalDuration += delta;
        this.stats.averageFrameDurationMs = this.totalDuration / this.stats.totalFrames;

        if (delta > this.stats.maxFrameDurationMs) {
          this.stats.maxFrameDurationMs = delta;
        }

        if (delta > BUDGET_120HZ_MS) {
          this.stats.jank120HzFrames++;
        }

        if (delta > BUDGET_60HZ_MS) {
          this.stats.jank60HzFrames++;
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  stop(tag: string = 'Screen'): FrameStats {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const { totalFrames, jank120HzFrames, maxFrameDurationMs, averageFrameDurationMs } = this.stats;
    const jankRate = totalFrames > 0 ? ((jank120HzFrames / totalFrames) * 100).toFixed(1) : '0';

    if (__DEV__) {
      console.log(
        `📊 [Profiler: ${tag}] Frames: ${totalFrames} | Avg: ${averageFrameDurationMs.toFixed(2)}ms | Max: ${maxFrameDurationMs.toFixed(2)}ms | 120Hz Drops: ${jank120HzFrames} (${jankRate}%)`
      );
    }

    return { ...this.stats };
  }
}
