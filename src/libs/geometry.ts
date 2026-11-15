/**
 * Width and height in pixels.
 */
export interface Size {
	width: number;
	height: number;
}

/**
 * Checks that a size can actually be drawn into.
 * @param size Size to check.
 * @returns `true` when both sides are positive.
 */
export const hasArea = ({ width, height }: Size): boolean =>
	width > 0 && height > 0;
