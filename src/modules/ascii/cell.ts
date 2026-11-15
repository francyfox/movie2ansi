import { hsl, hslToRgb, jitterRgb, mixRgb, rgbToCss } from "#libs/color";
import {
	GLITCH_CHANCE,
	GLITCH_EVERY_N_FRAMES,
	SHADE_LEVELS,
} from "./ascii.constants.ts";
import type { Cell, CellLook, Scene, Shade } from "./ascii.types.ts";
import { pickGlyph } from "./glyph.ts";

/**
 * Position of a 0–1 value among the cached shades.
 * @param value Any number; values outside 0–1 are clamped.
 * @returns An integer in `[0, SHADE_LEVELS]`.
 */
const shadeIndex = (value: number): number =>
	Math.min(SHADE_LEVELS, Math.max(0, Math.round(value * SHADE_LEVELS)));

/**
 * Reads a shade from a cache, creating it on first use.
 * @param shades Cache indexed by level.
 * @param level Shade level.
 * @param create Builds the shade for a level.
 * @returns The shade.
 */
const cachedShade = (
	shades: Shade[],
	level: number,
	create: (level: number) => Shade,
): Shade => {
	const cached = shades[level];
	if (cached !== undefined) return cached;
	const color = create(level);
	shades[level] = color;
	return color;
};

/**
 * Builds a cell with its canvas position and brightness.
 * @param row Cell row.
 * @param col Cell column.
 * @param scene Current frame.
 * @returns The cell.
 */
export const cellAt = (
	row: number,
	col: number,
	{ layout, luminance }: Scene,
): Cell => ({
	row,
	col,
	x: col * layout.pixelSize,
	y: row * layout.cellHeight,
	brightness: (luminance[row]?.[col] ?? 0) / 255,
});

/**
 * Whether a cell is bright enough (or dark enough, when inverted) to be drawn.
 * @param brightness Cell brightness, 0–1.
 * @param scene Current frame.
 * @returns `true` if the cell gets a character.
 */
export const isLit = (
	brightness: number,
	{ threshold, style }: Scene,
): boolean =>
	style.invert ? brightness < 1 - threshold : brightness > threshold;

/**
 * Background lightness of a lit cell; the curve exaggerates contrast.
 * @param brightness Cell brightness, 0–1.
 * @param invert Whether dark areas are the lit ones.
 * @returns Lightness, 0–1.
 */
const litLightness = (brightness: number, invert: boolean): number =>
	invert ? 1 - brightness ** 2 : brightness ** 2;

/**
 * Background lightness of any cell: contrast curve when lit, a dim constant otherwise.
 * @param brightness Cell brightness, 0–1.
 * @param scene Current frame.
 * @returns Lightness, 0–1.
 */
const backgroundLightness = (brightness: number, scene: Scene): number =>
	isLit(brightness, scene)
		? litLightness(brightness, scene.style.invert)
		: scene.threshold / 4;

/**
 * Rolls whether a cell flashes a random background color this frame.
 * @param scene Current frame.
 * @returns `true` for a glitch.
 */
const isGlitch = ({ frame, style, random }: Scene): boolean =>
	frame % GLITCH_EVERY_N_FRAMES === 0 &&
	random() < style.randomness * GLITCH_CHANCE;

/**
 * Background color of a cell.
 * @param cell Cell to color.
 * @param scene Current frame.
 * @returns A color, or `null` when the cell keeps the plain background.
 */
const cellBackground = (cell: Cell, scene: Scene): Shade | null => {
	const { style } = scene;
	if (isGlitch(scene)) {
		const rgb = jitterRgb(
			style.backgroundRgb,
			100 * style.randomness,
			scene.random,
		);
		return { rgb, css: rgbToCss(rgb) };
	}
	if (!style.backgroundGradient) return null;
	const level = shadeIndex(backgroundLightness(cell.brightness, scene));
	return cachedShade(style.backgroundShades, level, (lvl) => {
		const lightness = lvl / SHADE_LEVELS;
		return {
			rgb: hslToRgb(style.backgroundHue, style.backgroundSaturation, lightness),
			css: hsl(style.backgroundHue, style.backgroundSaturation, lightness),
		};
	});
};

/**
 * Character color: blends between the two font colors by how far past the threshold the cell is.
 * @param brightness Cell brightness, 0–1.
 * @param scene Current frame.
 * @returns The color.
 */
const textColor = (brightness: number, { style, threshold }: Scene): Shade => {
	const span = 1 - threshold;
	const blend = style.invert
		? brightness / span
		: (brightness - threshold) / span;
	const level = shadeIndex(blend);
	const [from, to] = style.invert
		? [style.fontRgb2, style.fontRgb]
		: [style.fontRgb, style.fontRgb2];
	return cachedShade(style.textShades, level, (lvl) => {
		const rgb = mixRgb(from, to, lvl / SHADE_LEVELS);
		return { rgb, css: rgbToCss(rgb) };
	});
};

/**
 * Decides what a cell looks like this frame: its background and, if it is lit, its character.
 * Blank characters count as no character, since they leave no mark.
 * @param cell Cell to describe.
 * @param scene Current frame.
 * @returns The cell's background and text.
 */
export const cellLook = (cell: Cell, scene: Scene): CellLook => {
	const background = cellBackground(cell, scene);
	if (!isLit(cell.brightness, scene)) return { background, text: null };
	const glyph = pickGlyph(cell, scene);
	if (glyph.char.trim() === "") return { background, text: null };
	return {
		background,
		text: { glyph, color: textColor(cell.brightness, scene) },
	};
};
