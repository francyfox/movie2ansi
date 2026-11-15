import type { Settings } from "./settings.types.ts";

/** All values of {@link TextMode}; use these instead of string literals. */
export const TEXT_MODE = {
	RANDOM: "Random Text",
	USER: "User Text",
} as const;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
	backgroundColor: "#51311e",
	backgroundGradient: true,
	backgroundSaturation: 30,
	fontColor: "#ff7800",
	fontColor2: "#e5e5e5",
	fontSizeFactor: 3,
	pixelSizeFactor: 90,
	threshold: 30,
	textInput: "PleiadesOrchestra",
	randomness: 3,
	invert: false,
	animationType: TEXT_MODE.RANDOM,
	effectWidth: 100,
};
