import { COUNT_BYTES, LIST_PLANE, LIST_PLANES } from "./format.ts";

/** The screen state while a file plays: three ids per cell, updated frame by frame. */
export interface CellDecoder {
	readonly cells: number;
	bg: (cell: number) => number;
	fg: (cell: number) => number;
	glyph: (cell: number) => number;
	/**
	 * Applies the next frame.
	 * A key frame starts from an empty screen; a delta overwrites only the cells it lists.
	 * @param frame A frame as written by the encoder.
	 * @param key Whether this is a key frame.
	 * @param changed Receives the index of every cell whose ids changed.
	 */
	apply: (frame: Uint8Array, key: boolean, changed: Set<number>) => void;
}

/** Reads the cells a frame lists. */
const forEachListed = (
	frame: Uint8Array,
	visit: (cell: number, bg: number, fg: number, glyph: number) => void,
): void => {
	const count = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(0, true);
	const at = (plane: number, offset: number, j: number): number =>
		frame[COUNT_BYTES + (plane + offset) * count + j] ?? 0;
	let cell = -1;
	for (let j = 0; j < count; j += 1) {
		cell += 1 + (at(LIST_PLANE.gap, 0, j) | (at(LIST_PLANE.gap, 1, j) << 8) | (at(LIST_PLANE.gap, 2, j) << 16));
		visit(
			cell,
			at(LIST_PLANE.bg, 0, j) | (at(LIST_PLANE.bg, 1, j) << 8),
			at(LIST_PLANE.fg, 0, j) | (at(LIST_PLANE.fg, 1, j) << 8),
			at(LIST_PLANE.glyph, 0, j) | (at(LIST_PLANE.glyph, 1, j) << 8),
		);
	}
};

/**
 * Creates an empty screen of `cells` cells (all ids 0).
 * @param cells Grid width times height.
 * @returns The decoder.
 */
export const createCellDecoder = (cells: number): CellDecoder => {
	const bgIds = new Uint16Array(cells);
	const fgIds = new Uint16Array(cells);
	const glyphIds = new Uint16Array(cells);
	return {
		cells,
		bg: (cell) => bgIds[cell] ?? 0,
		fg: (cell) => fgIds[cell] ?? 0,
		glyph: (cell) => glyphIds[cell] ?? 0,
		apply: (frame, key, changed) => {
			if (key) {
				const nextBg = new Uint16Array(cells);
				const nextFg = new Uint16Array(cells);
				const nextGlyph = new Uint16Array(cells);
				forEachListed(frame, (cell, bg, fg, glyph) => {
					nextBg[cell] = bg;
					nextFg[cell] = fg;
					nextGlyph[cell] = glyph;
				});
				for (let cell = 0; cell < cells; cell += 1)
					if (bgIds[cell] !== nextBg[cell] || fgIds[cell] !== nextFg[cell] || glyphIds[cell] !== nextGlyph[cell])
						changed.add(cell);
				bgIds.set(nextBg);
				fgIds.set(nextFg);
				glyphIds.set(nextGlyph);
				return;
			}
			forEachListed(frame, (cell, bg, fg, glyph) => {
				bgIds[cell] = bg;
				fgIds[cell] = fg;
				glyphIds[cell] = glyph;
				changed.add(cell);
			});
		},
	};
};

export { LIST_PLANES };
