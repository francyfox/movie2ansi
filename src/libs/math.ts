/**
 * Linear interpolation between two numbers.
 * @param from Value at `t = 0`.
 * @param to Value at `t = 1`.
 * @param t Interpolation factor.
 * @returns The interpolated value.
 */
export const lerp = (from: number, to: number, t: number): number =>
	from + (to - from) * Math.max(0, Math.min(1, t));
