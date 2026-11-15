import type { TEXT_MODE } from "./settings.constants.ts";

/**
 * How characters are chosen: by brightness from the gradient, or cycled from user text.
 * Values are listed in {@link TEXT_MODE}.
 */
export type TextMode = (typeof TEXT_MODE)[keyof typeof TEXT_MODE];

/**
 * User-facing settings: hex colors, percentages as 0–100.
 */
export interface Settings {
	/** Background color, `#rrggbb`. */
	backgroundColor: string;
	/** Tint cell backgrounds by brightness instead of a flat fill. */
	backgroundGradient: boolean;
	/** Saturation of the background tint, 0–100. */
	backgroundSaturation: number;
	/** Character color for cells just past the threshold, `#rrggbb`. */
	fontColor: string;
	/** Character color for the brightest cells, `#rrggbb`. */
	fontColor2: string;
	/** Character size multiplier, 0–10. */
	fontSizeFactor: number;
	/** How many cells fit along the shorter side, 10–200. */
	pixelSizeFactor: number;
	/** Brightness a cell needs to get a character, 0–95. */
	threshold: number;
	/** Text cycled through the grid in "User Text" mode. */
	textInput: string;
	/** Amount of rain, glitches and threshold drift, 0–100. */
	randomness: number;
	/** Draw characters in dark areas instead of bright ones. */
	invert: boolean;
	/** How characters are chosen. */
	animationType: TextMode;
	/** Share of the width covered by the effect, 0–100; the rest shows the plain video. */
	effectWidth: number;
}
