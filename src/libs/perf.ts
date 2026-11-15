/**
 * Average of the most recent samples.
 */
export interface RollingAverage {
	/** Adds a sample, dropping the oldest once the window is full. */
	push: (value: number) => void;
	/** Average of the samples in the window, `0` when empty. */
	value: () => number;
	/** Middle sample of the window, `0` when empty; ignores one-off spikes. */
	median: () => number;
}

/**
 * Creates an average over a sliding window of samples.
 * @param capacity How many recent samples to keep.
 * @returns The rolling average.
 */
export const createRollingAverage = (capacity: number): RollingAverage => {
	const samples: number[] = [];
	return {
		push: (value) => {
			samples.push(value);
			if (samples.length > capacity) samples.shift();
		},
		value: () =>
			samples.length === 0
				? 0
				: samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
		median: () => {
			const sorted = [...samples].sort((a, b) => a - b);
			return sorted[Math.floor(sorted.length / 2)] ?? 0;
		},
	};
};

/**
 * Runs a function and reports how long it took.
 * @param run Function to time.
 * @param record Receives the duration in milliseconds.
 * @returns Whatever `run` returned.
 */
export const measure = <T>(run: () => T, record: (ms: number) => void): T => {
	const start = performance.now();
	const result = run();
	record(performance.now() - start);
	return result;
};

/**
 * Smallest step `performance.now()` takes, i.e. how coarse the browser's timer is.
 * Browsers round it down to protect privacy, which makes short timings noisy.
 * Busy-waits for the timer to tick, so it is a loop, not recursion: a coarse timer can take millions of spins.
 * @param ticks How many steps to watch; the smallest one wins.
 * @returns The step in milliseconds.
 */
export const timerResolution = (ticks = 5): number => {
	let smallest = Number.POSITIVE_INFINITY;
	let previous = performance.now();
	let seen = 0;
	while (seen < ticks) {
		const now = performance.now();
		if (now === previous) continue;
		smallest = Math.min(smallest, now - previous);
		previous = now;
		seen += 1;
	}
	return smallest;
};

/**
 * Events per second over a sliding time window.
 */
export interface RateMeter {
	/** Records `count` events that happened at `now` (ms). */
	push: (now: number, count?: number) => void;
	/** Events per second over the window, `0` until two samples exist. */
	value: () => number;
}

/**
 * Creates a meter of events per second over the most recent `windowMs`.
 * @param windowMs Length of the sliding window in milliseconds.
 * @returns The rate meter.
 */
export const createRateMeter = (windowMs: number): RateMeter => {
	const samples: { at: number; count: number }[] = [];
	return {
		push: (now, count = 1) => {
			samples.push({ at: now, count });
			while (samples.length > 2 && now - (samples[0]?.at ?? now) > windowMs)
				samples.shift();
		},
		value: () => {
			const first = samples[0];
			const last = samples[samples.length - 1];
			if (!first || !last || last.at === first.at) return 0;
			// The first sample only marks the start of the window, so its events are not counted.
			const events =
				samples.reduce((sum, sample) => sum + sample.count, 0) - first.count;
			return (events * 1000) / (last.at - first.at);
		},
	};
};
