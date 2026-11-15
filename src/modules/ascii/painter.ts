import { FONT_FAMILY } from "./ascii.constants.ts";

/**
 * Canvas state setters that skip redundant assignments.
 * Setting `fillStyle` or `font` makes the browser parse a string every time, even for the same value.
 */
export interface Painter {
	/** Sets `fillStyle` unless it already has this color. */
	fill: (color: string) => void;
	/** Sets `font` unless it already has this size. */
	font: (size: number) => void;
}

/**
 * Tracks the canvas state for one frame, so call it once per frame:
 * a canvas resize or other code may have changed the state in between.
 * @param ctx Canvas to paint on.
 * @returns The painter.
 */
export const createPainter = (ctx: CanvasRenderingContext2D): Painter => {
	let fillColor: string | null = null;
	let fontSize = Number.NaN;
	return {
		fill: (color) => {
			if (color === fillColor) return;
			ctx.fillStyle = color;
			fillColor = color;
		},
		font: (size) => {
			if (size === fontSize) return;
			ctx.font = `${size}px ${FONT_FAMILY}`;
			fontSize = size;
		},
	};
};
