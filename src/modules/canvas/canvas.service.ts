import type { Size } from "#libs/geometry";
import { byId } from "#libs/utils";

/**
 * Gets a 2D rendering context, failing loudly if the browser can't provide one.
 * @param canvas Canvas to draw on.
 * @param options Context creation settings.
 * @returns The 2D context.
 */
export const context2d = (
	canvas: HTMLCanvasElement,
	options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D => {
	const context = canvas.getContext("2d", options);
	if (!context) throw new Error("2D canvas context is not available");
	return context;
};

export const canvas = byId<HTMLCanvasElement>("player");
export const ctx = context2d(canvas);

/**
 * Current size of the output canvas.
 * @returns Width and height in pixels.
 */
export const canvasSize = (): Size => ({
	width: canvas.width,
	height: canvas.height,
});

/**
 * Resizes the output canvas, which also clears it.
 * @param size New canvas size.
 */
export const resizeCanvas = ({ width, height }: Size): void => {
	canvas.width = width;
	canvas.height = height;
};

/**
 * Draws an image source on the output canvas, scaled to a size.
 * @param source Video, image or canvas to draw.
 * @param size Size to scale the source to.
 */
export const drawImage = (
	source: CanvasImageSource,
	{ width, height }: Size,
): void => {
	ctx.drawImage(source, 0, 0, width, height);
};

const gridCanvas = document.createElement("canvas");
const gridCtx = context2d(gridCanvas, { willReadFrequently: true });

/**
 * Draws a video frame shrunk to one pixel per grid cell, letting the browser do the averaging.
 * Read the result with {@link readCells}.
 * @param video Video to draw.
 * @param size Output canvas size the grid is laid over.
 * @param cells Grid size: `width` is columns, `height` is rows.
 * @param area Part of the output canvas the grid covers, in canvas pixels.
 */
export const drawCells = (
	video: HTMLVideoElement,
	size: Size,
	cells: Size,
	area: Size,
): void => {
	if (gridCanvas.width !== cells.width || gridCanvas.height !== cells.height) {
		gridCanvas.width = cells.width;
		gridCanvas.height = cells.height;
		gridCtx.imageSmoothingQuality = "high";
	}
	gridCtx.drawImage(
		video,
		0,
		0,
		(area.width / size.width) * video.videoWidth,
		(area.height / size.height) * video.videoHeight,
		0,
		0,
		cells.width,
		cells.height,
	);
};

/**
 * Reads the pixels drawn by {@link drawCells}.
 * @param cells Grid size: `width` is columns, `height` is rows.
 * @returns One RGBA pixel per cell.
 */
export const readCells = (cells: Size): ImageData =>
	gridCtx.getImageData(0, 0, cells.width, cells.height);
