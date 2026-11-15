import type { Rgb } from "#libs/color";

export const FONT_FAMILY = "Courier New";
export const CELL_TO_FONT_RATIO = 0.65;
export const MAX_FONT_SCALE = 3;
export const FONT_FACTOR_DIVISOR = 3;

export const GRADIENT = "____``..--^^~~<>??123456789%%&&@@".replaceAll(
	"_",
	" ",
);
export const LUMA: Rgb = { r: 0.299, g: 0.587, b: 0.114 };

export const RAIN_CYCLE_FRAMES = 100;
export const GLITCH_EVERY_N_FRAMES = 8;
export const GLITCH_CHANCE = 0.002;
export const RANDOM_CHAR_CHANCE = 0.005;
export const THRESHOLD_WOBBLE = 0.2;
export const THRESHOLD_WOBBLE_PERIOD = 30;

/** Colors are cached in this many steps along a gradient; finer than the eye can tell. */
export const SHADE_LEVELS = 255;
