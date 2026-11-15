import { hexToRgb, hueOf } from "#libs/color";
import type { Settings } from "#modules/settings";
import {
	THRESHOLD_WOBBLE,
	THRESHOLD_WOBBLE_PERIOD,
} from "./ascii.constants.ts";
import type { Style } from "./ascii.types.ts";

/**
 * Normalizes user settings into values the renderer works with.
 * @param source User-facing settings.
 * @returns Parsed colors and 0–1 fractions.
 */
export const toStyle = (source: Readonly<Settings>): Style => {
	const backgroundRgb = hexToRgb(source.backgroundColor);
	return {
		background: source.backgroundColor,
		backgroundRgb,
		backgroundHue: hueOf(backgroundRgb),
		backgroundSaturation: source.backgroundSaturation,
		backgroundGradient: source.backgroundGradient,
		fontRgb: hexToRgb(source.fontColor),
		fontRgb2: hexToRgb(source.fontColor2),
		fontSizeFactor: source.fontSizeFactor,
		threshold: source.threshold / 100,
		randomness: source.randomness / 100,
		invert: source.invert,
		textMode: source.animationType,
		textInput: source.textInput,
		backgroundShades: [],
		textShades: [],
	};
};

/**
 * Threshold that slowly drifts over time, more so with higher randomness.
 * @param style Base threshold and randomness.
 * @param frame Current frame number.
 * @returns The threshold for this frame.
 */
export const oscillatingThreshold = (
	{ threshold, randomness }: Style,
	frame: number,
): number =>
	threshold +
	THRESHOLD_WOBBLE * Math.sin(frame / THRESHOLD_WOBBLE_PERIOD) * randomness;
