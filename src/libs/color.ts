import type { Random } from "./random.ts";
import { lerp } from "./math.ts";

/**
 * Color with 0–255 channels.
 */
export interface Rgb {
	r: number;
	g: number;
	b: number;
}

/**
 * Rounds and clamps a number into a valid color channel.
 * @param value Any number.
 * @returns An integer in `[0, 255]`.
 */
const clampByte = (value: number): number =>
	Math.min(255, Math.max(0, Math.round(value)));

/**
 * Shifts a value by a random amount within `±range / 2`.
 * @param value Base value.
 * @param range Total width of the random spread.
 * @param random Source of randomness.
 * @returns The shifted value.
 */
const jitter = (value: number, range: number, random: Random): number =>
	value + range * random() - range / 2;

/**
 * Position on the hue wheel in sixths, before conversion to degrees.
 * @param color Color to inspect.
 * @param max Largest channel of the color.
 * @param delta Difference between the largest and smallest channel.
 * @returns Hue in sixths of a turn, possibly negative.
 */
const hueSector = ({ r, g, b }: Rgb, max: number, delta: number): number => {
	if (delta === 0) return 0;
	if (max === r) return (g - b) / delta;
	if (max === g) return 2 + (b - r) / delta;
	return 4 + (r - g) / delta;
};

/**
 * Parses a `#rrggbb` color; anything unparsable becomes black.
 * @param hex Color with or without the leading `#`.
 * @returns The parsed color.
 */
export const hexToRgb = (hex: string): Rgb => {
	const [, r = "00", g = "00", b = "00"] =
		/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) ?? [];
	return {
		r: Number.parseInt(r, 16),
		g: Number.parseInt(g, 16),
		b: Number.parseInt(b, 16),
	};
};

/**
 * Formats a color for canvas `fillStyle`.
 * @param color Color to format.
 * @returns A CSS `rgb()` string.
 */
export const rgbToCss = ({ r, g, b }: Rgb): string => `rgb(${r},${g},${b})`;

/**
 * Formats an HSL color for canvas `fillStyle`.
 * @param hue Hue in degrees.
 * @param saturation Saturation in percent (0–100).
 * @param lightness Lightness as a 0–1 fraction.
 * @returns A CSS `hsl()` string.
 */
export const hsl = (
	hue: number,
	saturation: number,
	lightness: number,
): string => `hsl(${hue},${saturation}%,${lightness * 100}%)`;

/**
 * Converts an HSL color to RGB.
 * @param hue Hue in degrees.
 * @param saturation Saturation in percent (0–100).
 * @param lightness Lightness as a 0–1 fraction.
 * @returns The color with integer 0–255 channels.
 */
export const hslToRgb = (
	hue: number,
	saturation: number,
	lightness: number,
): Rgb => {
	const spread = (saturation / 100) * Math.min(lightness, 1 - lightness);
	const channel = (offset: number): number => {
		const sector = (offset + hue / 30) % 12;
		const value =
			lightness - spread * Math.max(-1, Math.min(sector - 3, 9 - sector, 1));
		return Math.round(value * 255);
	};
	return { r: channel(0), g: channel(8), b: channel(4) };
};

/**
 * Blends two colors channel by channel.
 * @param from Color at `t = 0`.
 * @param to Color at `t = 1`.
 * @param t Blend factor.
 * @returns The blended color.
 */
export const mixRgb = (from: Rgb, to: Rgb, t: number): Rgb => ({
	r: Math.round(lerp(from.r, to.r, t)),
	g: Math.round(lerp(from.g, to.g, t)),
	b: Math.round(lerp(from.b, to.b, t)),
});

/**
 * Randomly shifts every channel of a color, keeping it valid.
 * @param color Base color.
 * @param range Total width of the random spread per channel.
 * @param random Source of randomness.
 * @returns The shifted color.
 */
export const jitterRgb = (
	{ r, g, b }: Rgb,
	range: number,
	random: Random,
): Rgb => ({
	r: clampByte(jitter(r, range, random)),
	g: clampByte(jitter(g, range, random)),
	b: clampByte(jitter(b, range, random)),
});

/**
 * Hue of a color.
 * @param rgb Color to inspect.
 * @returns Hue in degrees, `[0, 360)`.
 */
export const hueOf = (rgb: Rgb): number => {
	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const delta = max - Math.min(rgb.r, rgb.g, rgb.b);
	const degrees = hueSector(rgb, max, delta) * 60;
	return degrees < 0 ? degrees + 360 : degrees;
};
