import type { Size } from "#libs/geometry";
import { mapRange } from "#libs/iteration";
import type { Random } from "#libs/random";
import { CELL_TO_FONT_RATIO } from "./ascii.constants.ts";
import type { Layout, RainColumns } from "./ascii.types.ts";

/**
 * Splits the canvas into a grid of character cells; square unless `cellAspect` says otherwise.
 * @param size Canvas size.
 * @param pixelSizeFactor How many cells fit along the shorter side.
 * @param effectWidth Fraction (0–1) of the width covered by the effect.
 * @param cellAspect Cell width divided by cell height: `1` for square cells (canvas), `0.5` for a terminal.
 * @returns Grid geometry and base font size.
 */
export const computeLayout = (
	{ width, height }: Size,
	pixelSizeFactor: number,
	effectWidth: number,
	cellAspect = 1,
): Layout => {
	const pixelSize = Math.max(
		1,
		Math.ceil(Math.min(width, height) / pixelSizeFactor),
	);
	const cellHeight = pixelSize / cellAspect;
	return {
		pixelSize,
		cellHeight,
		effectWidth,
		cols: Math.ceil(Math.ceil(width / pixelSize) * effectWidth),
		rows: Math.ceil(height / cellHeight),
		fontSize: pixelSize / CELL_TO_FONT_RATIO,
	};
};

/**
 * Picks "digital rain" columns at random.
 * @param layout Grid geometry.
 * @param randomness Chance (0–1) that a column becomes a rain column.
 * @param random Source of randomness.
 * @returns A random starting row for each rain column, `null` for the rest.
 */
export const createRain = (
	{ cols, rows }: Layout,
	randomness: number,
	random: Random,
): RainColumns =>
	mapRange(cols, () =>
		random() < randomness ? Math.floor(random() * rows) : null,
	);
