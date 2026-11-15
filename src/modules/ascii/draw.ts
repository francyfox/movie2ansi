import { foldGrid } from "#libs/iteration";
import type { Cell, Glyph, Scene } from "./ascii.types.ts";
import { cellAt, cellLook } from "./cell.ts";
import { createPainter, type Painter } from "./painter.ts";

/**
 * Paints a cell's square.
 * @param ctx Canvas to draw on.
 * @param painter Skips redundant canvas state changes.
 * @param cell Cell to paint.
 * @param color CSS color.
 * @param pixelSize Cell width in pixels.
 * @param cellHeight Cell height in pixels.
 */
const fillCell = (
	ctx: CanvasRenderingContext2D,
	painter: Painter,
	cell: Cell,
	color: string,
	pixelSize: number,
	cellHeight: number,
): void => {
	painter.fill(color);
	ctx.fillRect(cell.x, cell.y, pixelSize, cellHeight);
};

/**
 * Draws a character at a cell's baseline.
 * @param ctx Canvas to draw on.
 * @param painter Skips redundant canvas state changes.
 * @param cell Cell to draw into.
 * @param glyph Character and font size.
 * @param color CSS color.
 * @param cellHeight Cell height in pixels.
 */
const drawGlyph = (
	ctx: CanvasRenderingContext2D,
	painter: Painter,
	cell: Cell,
	glyph: Glyph,
	color: string,
	cellHeight: number,
): void => {
	painter.font(glyph.size);
	painter.fill(color);
	ctx.fillText(glyph.char, cell.x, cell.y + cellHeight);
};

/**
 * Draws a cell as described by `cellLook`.
 * @param ctx Canvas to draw on.
 * @param painter Skips redundant canvas state changes.
 * @param cell Cell to draw.
 * @param scene Current frame.
 */
const drawCell = (
	ctx: CanvasRenderingContext2D,
	painter: Painter,
	cell: Cell,
	scene: Scene,
): void => {
	const { pixelSize, cellHeight } = scene.layout;
	const { background, text } = cellLook(cell, scene);
	if (background !== null)
		fillCell(ctx, painter, cell, background.css, pixelSize, cellHeight);
	if (text !== null)
		drawGlyph(ctx, painter, cell, text.glyph, text.color.css, cellHeight);
};

/**
 * Clears the part of the canvas covered by the effect with the background color.
 * @param ctx Canvas to draw on.
 * @param scene Current frame.
 */
const fillEffectArea = (
	ctx: CanvasRenderingContext2D,
	{ size, layout, style }: Scene,
): void => {
	ctx.fillStyle = style.background;
	ctx.fillRect(0, 0, size.width * layout.effectWidth, size.height);
};

/**
 * Draws the whole ASCII frame, column by column.
 * @param ctx Canvas to draw on.
 * @param scene Current frame.
 */
export const drawAscii = (
	ctx: CanvasRenderingContext2D,
	scene: Scene,
): void => {
	fillEffectArea(ctx, scene);
	const { cols, rows } = scene.layout;
	const painter = createPainter(ctx);
	foldGrid<void>(
		cols,
		rows,
		(_, col, row) => drawCell(ctx, painter, cellAt(row, col, scene), scene),
		undefined,
	);
};
