import { mapRange } from "#libs/iteration";
import { LUMA } from "./ascii.constants.ts";
import type { LuminanceGrid } from "./ascii.types.ts";
import { tone } from "./tone.ts";

/**
 * Perceived luminance of one RGBA pixel.
 * @param pixels Raw RGBA bytes.
 * @param offset Index of the pixel's red byte.
 * @returns Luminance in `[0, 255]`.
 */
const luminanceAt = (pixels: Uint8ClampedArray, offset: number): number =>
	LUMA.r * (pixels[offset] ?? 0) +
	LUMA.g * (pixels[offset + 1] ?? 0) +
	LUMA.b * (pixels[offset + 2] ?? 0);

/**
 * Luminance of a frame that is already one pixel per cell.
 * @param image Frame with one pixel per cell.
 * @returns Luminance per cell, `[row][col]`.
 */
export const gridLuminance = (image: ImageData): LuminanceGrid =>
	mapRange(image.height, (row) =>
		mapRange(image.width, (col) =>
			tone(luminanceAt(image.data, (row * image.width + col) * 4)),
		),
	);
