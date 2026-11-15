export interface StabilizeOptions {
	/** Brightness is rounded to a multiple of this; `1` keeps every level. */
	step: number;
	/** A cell keeps its previous brightness unless it moved by more than this; `0` follows every change. */
	deadband: number;
}

/**
 * Calms video noise before cells are decided.
 * A cell's brightness drifts by a level or two between frames from compression noise alone. Left as is, that
 * changes the cell's background shade, so the cell lands in every delta and shimmers on screen.
 * Holding the old value inside a dead zone makes such cells identical frame to frame, and rounding to a step
 * leaves fewer distinct shades for the compressor to describe.
 * @param options Step and dead zone.
 * @returns A function that takes the next gray frame and returns the stabilized one.
 *          It remembers the previous result, so call it once per frame, in order.
 */
export const createStabilizer = ({ step, deadband }: StabilizeOptions) => {
	let held: Uint8Array | null = null;
	const snap = (value: number): number =>
		Math.min(255, Math.round(value / step) * step);
	return (frame: Uint8Array): Uint8Array => {
		const previous = held;
		const next = new Uint8Array(frame.length);
		for (let i = 0; i < frame.length; i += 1) {
			const value = frame[i] ?? 0;
			const before = previous?.[i];
			next[i] =
				before !== undefined && Math.abs(value - before) <= deadband
					? before
					: snap(value);
		}
		held = next;
		return next;
	};
};
