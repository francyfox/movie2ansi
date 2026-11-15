import type { Rgb } from "#libs/color";

/** Moves the cursor to the top left; every key frame starts with it. */
export const CURSOR_HOME = "\x1b[H";
const RESET = "\x1b[0m";

/**
 * What one cell shows, as the exact escape sequences that produce it.
 * Keeping strings makes "did this cell change" a plain comparison.
 */
export interface AnsiCell {
	/** Background SGR; every cell has one, so the output does not depend on the terminal theme. */
	bg: string;
	/** Character-color SGR, `""` when the cell is blank and no color is needed. */
	fg: string;
	char: string;
}

/**
 * True-color SGR sequence.
 * @param layer `38` for the character color, `48` for the background.
 * @param color Color to set.
 * @returns The escape sequence.
 */
const sgr = (layer: 38 | 48, { r, g, b }: Rgb): string =>
	`\x1b[${layer};2;${r};${g};${b}m`;

/**
 * Builds an ANSI cell from decoded colors.
 * @param bg Background color.
 * @param fg Character color, `null` for a blank.
 * @param char The character.
 * @returns The cell.
 */
export const ansiCell = (bg: Rgb, fg: Rgb | null, char: string): AnsiCell => ({
	bg: sgr(48, bg),
	fg: fg ? sgr(38, fg) : "",
	char,
});

/**
 * Tracks the colors the terminal currently has, so a color is written only when it changes.
 */
const createPen = () => {
	let bg = "";
	let fg = "";
	return {
		/** @returns The escape sequences needed before printing `cell`. */
		set: (cell: AnsiCell): string => {
			let out = "";
			if (cell.bg !== bg) out += bg = cell.bg;
			if (cell.fg !== "" && cell.fg !== fg) out += fg = cell.fg;
			return out;
		},
		/** Forgets the state after a reset. */
		reset: (): void => {
			bg = "";
			fg = "";
		},
	};
};

/**
 * A key frame: every cell, row by row, so it can be printed with `cat`.
 * @param cells Cells of the frame, row after row.
 * @param cols Grid width.
 * @returns ANSI text starting with {@link CURSOR_HOME}, rows separated by `\n`.
 */
export const keyFrame = (cells: readonly AnsiCell[], cols: number): string => {
  const pen = createPen();
	const rows: string[] = []
  let row = "";

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i] as AnsiCell
    row += pen.set(cell).concat(cell.char);

    if ((i + 1) % cols === 0) {
			rows.push(row + RESET);
			row = "";
			pen.reset();
		}
  }

  return CURSOR_HOME + rows.join("\n");
};

/**
 * A delta frame: only the cells that differ from the previous frame.
 * The cursor moves with `ESC[row;colH` only when the next changed cell is not right after the last one.
 * @param previous Cells of the previous frame.
 * @param cells Cells of this frame.
 * @param cols Grid width.
 * @returns ANSI text; empty when nothing changed.
 */
export const deltaFrame = (
	previous: readonly AnsiCell[],
	cells: readonly AnsiCell[],
	cols: number,
): string => {
	const pen = createPen();
	let out = "";
	let next = -1; // index the cursor is on after the last printed cell
	cells.forEach((cell, index) => {
		const before = previous[index];
		if (
			before &&
			before.bg === cell.bg &&
			before.fg === cell.fg &&
			before.char === cell.char
		)
			return;
		// A row change needs a move too: the cursor does not wrap by itself at the last column.
		if (index !== next || index % cols === 0)
			out += `\x1b[${Math.floor(index / cols) + 1};${(index % cols) + 1}H`;
		out += pen.set(cell) + cell.char;
		next = index + 1;
	});
	return out === "" ? out : out + RESET;
};
