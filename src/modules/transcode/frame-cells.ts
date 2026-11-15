import type { Size } from "#libs/geometry";
import { mapRange } from "#libs/iteration";
import { seededRandom } from "#libs/random";
import {
	cellAt,
	cellLook,
	computeLayout,
	createRain,
	createScene,
	type LuminanceGrid,
	toStyle,
} from "#modules/ascii";
import type { RawCell } from "#modules/m2a";
import type { Settings } from "#modules/settings";
import { createStabilizer } from "./stabilize.ts";

export interface FrameCellsOptions {
	/** Size of the source video in pixels. */
	size: Size;
	/** Cell width divided by cell height. */
	cellAspect: number;
	/** Seed for rain, glitches and random characters; the same seed gives the same output. */
	seed: number;
	luminanceStep: number;
	deadband: number;
	look: Readonly<Settings>;
}

/**
 * Reshapes one gray frame (a byte per cell) into a luminance grid.
 * @param frame Raw gray bytes, `cols * rows` long.
 * @param cols Grid width.
 * @param rows Grid height.
 * @returns Luminance per cell, `[row][col]`.
 */
const toGrid = (frame: Uint8Array, cols: number, rows: number): LuminanceGrid =>
	mapRange(rows, (row) => Array.from(frame.subarray(row * cols, (row + 1) * cols)));

/**
 * The step shared by the Bun encoder and the browser one: turns gray frames, one byte per cell, into cells.
 * Where the gray frames come from (ffmpeg, a `<video>`) is the caller's business.
 * @param options Source size and look.
 * @returns The grid size to scale frames to, and `next`, which takes frames in order.
 */
export const createFrameCells = ({ size, cellAspect, seed, luminanceStep, deadband, look }: FrameCellsOptions) => {
	const layout = computeLayout(size, look.pixelSizeFactor, 1, cellAspect);
	const { cols, rows } = layout;
	const style = toStyle(look);
	const rain = createRain(layout, style.randomness, seededRandom(seed));
	const stabilize = createStabilizer({ step: luminanceStep, deadband });
	let frames = 0;

	return {
		cols,
		rows,
		/**
		 * @param gray One frame scaled to `cols * rows`, a luminance byte per cell.
		 * @returns The frame's cells and how many of them show a character.
		 */
		next(gray: Uint8Array): { cells: RawCell[]; lit: number } {
			const scene = createScene({
				size,
				style,
				layout,
				rain,
				luminance: toGrid(stabilize(gray), cols, rows),
				frame: frames,
				random: seededRandom(seed + frames),
			});
			frames += 1;
			const cells: RawCell[] = [];
			let lit = 0;
			for (let i = 0; i < cols * rows; i += 1) {
				const cell = cellLook(cellAt(Math.floor(i / cols), i % cols, scene), scene);
				if (cell.text !== null) lit += 1;
				cells.push({
					bg: cell.background?.rgb ?? style.backgroundRgb,
					fg: cell.text?.color.rgb ?? null,
					char: cell.text?.glyph.char ?? " ",
				});
			}
			return { cells, lit };
		},
	};
};
