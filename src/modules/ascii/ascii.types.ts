import type { Rgb } from "#libs/color";
import type { Size } from "#libs/geometry";
import type { Random } from "#libs/random";
import type { TextMode } from "#modules/settings";

/**
 * Per column: the row "digital rain" starts at, or `null` for a regular column.
 */
export type RainColumns = readonly (number | null)[];

/**
 * Average luminance (0–255) per cell, indexed `[row][col]`.
 */
export type LuminanceGrid = readonly (readonly number[])[];

/**
 * A color in both forms its consumers need: numbers for ANSI, a string for canvas.
 */
export interface Shade {
	rgb: Rgb;
	css: string;
}

/**
 * Settings normalized for rendering: colors parsed, percentages turned into 0–1.
 */
export interface Style {
	background: string;
	backgroundRgb: Rgb;
	backgroundHue: number;
	backgroundSaturation: number;
	backgroundGradient: boolean;
	fontRgb: Rgb;
	fontRgb2: Rgb;
	fontSizeFactor: number;
	threshold: number;
	randomness: number;
	invert: boolean;
	textMode: TextMode;
	textInput: string;
	/** Lazily filled cache of background colors, indexed by lightness level. */
	backgroundShades: Shade[];
	/** Lazily filled cache of character colors, indexed by blend level. */
	textShades: Shade[];
}

/**
 * Character grid geometry derived from the canvas size and resolution setting.
 */
export interface Layout {
	/** Cell width in pixels. */
	pixelSize: number;
	/** Cell height in pixels: `pixelSize / cellAspect`, equal to `pixelSize` for square cells. */
	cellHeight: number;
	cols: number;
	rows: number;
	fontSize: number;
	effectWidth: number;
}

/**
 * Everything needed to draw one frame.
 */
export interface Scene {
	size: Size;
	style: Style;
	layout: Layout;
	rain: RainColumns;
	luminance: LuminanceGrid;
	frame: number;
	threshold: number;
	/** Every random decision of the frame goes through this; seed it for reproducible output. */
	random: Random;
}

/**
 * One grid cell: its position and normalized brightness (0–1).
 */
export interface Cell {
	row: number;
	col: number;
	x: number;
	y: number;
	brightness: number;
}

/**
 * A character and the font size to draw it with.
 */
export interface Glyph {
	char: string;
	size: number;
}

/**
 * What a cell looks like in one frame, independent of how it is output.
 * `text` is `null` when the cell shows no visible character.
 */
export interface CellLook {
	background: Shade | null;
	text: { glyph: Glyph; color: Shade } | null;
}
