/**
 * Source of numbers in `[0, 1)`, shaped like `Math.random`.
 */
export type Random = () => number;

/**
 * Small seeded generator (mulberry32): the same seed always gives the same sequence.
 * @param seed Any integer.
 * @returns A function returning the next number in `[0, 1)` on every call.
 */
export const seededRandom = (seed: number): Random => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
