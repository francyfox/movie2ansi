import {
	FONT_FACTOR_DIVISOR,
	GRADIENT,
	MAX_FONT_SCALE,
	RAIN_CYCLE_FRAMES,
	RANDOM_CHAR_CHANCE,
} from "./ascii.constants.ts";
import type { Random } from "#libs/random";
import { TEXT_MODE } from "#modules/settings";
import type { Cell, Glyph, Scene } from "./ascii.types.ts";

/**
 * Picks a gradient character whose visual density matches the brightness.
 * @param brightness Cell brightness, 0–1.
 * @returns A single character.
 */
const charForBrightness = (brightness: number): string =>
	GRADIENT[Math.floor(brightness * (GRADIENT.length - 1))] ?? "";

/**
 * Picks any gradient character at random.
 * @param random Source of randomness.
 * @returns A single character.
 */
const randomGradientChar = (random: Random): string =>
	GRADIENT[Math.floor(random() * GRADIENT.length)] ?? "";

/**
 * Character of the user text for a cell, reading the grid left to right, top to bottom.
 * @param cell Cell to fill.
 * @param scene Current frame.
 * @returns A single character, or `""` when the text is empty.
 */
const userTextChar = ({ row, col }: Cell, { style, layout }: Scene): string =>
	style.textInput[(row * layout.cols + col) % style.textInput.length] ?? "";

/**
 * Whether the falling rain in a column has reached a row yet.
 * @param row Cell row.
 * @param startRow Row the rain in this column starts at.
 * @param scene Current frame.
 * @returns `true` if the cell is covered by rain.
 */
const isRainVisible = (
	row: number,
	startRow: number,
	{ frame, layout }: Scene,
): boolean =>
	(((frame + startRow) % RAIN_CYCLE_FRAMES) / RAIN_CYCLE_FRAMES) * layout.rows +
		startRow >
	row;

/**
 * Font size scaled by the font size setting and an optional per-cell level.
 * @param scene Current frame.
 * @param level Extra multiplier, 0–1; `1` by default.
 * @returns Font size in pixels, capped at `MAX_FONT_SCALE` times the base size.
 */
const fontSizeFor = ({ layout, style }: Scene, level = 1): number =>
	Math.min(
		layout.fontSize * MAX_FONT_SCALE,
		(layout.fontSize * style.fontSizeFactor * level) / FONT_FACTOR_DIVISOR,
	);

/**
 * How large user text should be in a cell: brighter cells get bigger letters.
 * @param brightness Cell brightness, 0–1.
 * @param invert Whether darker cells get bigger letters instead.
 * @returns Size level, 0–1.
 */
const userTextLevel = (brightness: number, invert: boolean): number =>
	invert ? 1 - brightness : brightness;

/**
 * Chooses which character to draw in a cell and at what size.
 * Rain columns win, then random glitch characters, then the selected text mode.
 * @param cell Cell to fill.
 * @param scene Current frame.
 * @returns The glyph to draw.
 */
export const pickGlyph = (cell: Cell, scene: Scene): Glyph => {
	const size = fontSizeFor(scene);
	const rainStart = scene.rain[cell.col] ?? null;

	if (rainStart !== null) {
		const visible = isRainVisible(cell.row, rainStart, scene);
		return { char: visible ? charForBrightness(cell.brightness) : "", size };
	}
	if (scene.random() < RANDOM_CHAR_CHANCE * scene.style.randomness) {
		return { char: randomGradientChar(scene.random), size };
	}
	if (scene.style.textMode === TEXT_MODE.RANDOM) {
		return { char: charForBrightness(cell.brightness), size };
	}
	return {
		char: userTextChar(cell, scene),
		size: Math.floor(
			fontSizeFor(scene, userTextLevel(cell.brightness, scene.style.invert)),
		),
	};
};
