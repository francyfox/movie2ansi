import type { Rgb } from "#libs/color";
import {
	COUNT_BYTES,
	type GopIndexEntry,
	LIST_PLANE,
	listBytes,
	MAGIC,
	MAX_ID,
	type M2aHeader,
	type M2aMeta,
} from "./format.ts";

/** What one cell shows, before it gets ids. */
export interface RawCell {
	bg: Rgb;
	/** `null` for a blank cell, which needs no character color. */
	fg: Rgb | null;
	char: string;
}

/** The frames of one GOP, not yet compressed. */
export interface RawGop {
	firstFrame: number;
	raw: Uint8Array<ArrayBuffer>;
}

const textEncoder = new TextEncoder();

const hex = ({ r, g, b }: Rgb): string =>
	`#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/**
 * Gives every distinct value a small id in order of first appearance.
 * @param keyOf Identity of a value.
 * @param reserved Values that take ids 0, 1, … before anything else.
 * @returns `idOf` to look up or add, and `values` in id order.
 */
const createTable = <T>(keyOf: (value: T) => string | number, reserved: readonly T[] = []) => {
	const ids = new Map<string | number, number>();
	const values: T[] = [];
	const idOf = (value: T): number => {
		const key = keyOf(value);
		let id = ids.get(key);
		if (id === undefined) {
			id = values.length;
			if (id > MAX_ID) throw new Error("More than 65536 distinct values: ids are 16 bits");
			ids.set(key, id);
			values.push(value);
		}
		return id;
	};
	for (const value of reserved) idOf(value);
	return { idOf, values };
};

const rgbKey = ({ r, g, b }: Rgb): number => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

/**
 * The part of encoding that does not depend on where bytes go: color and glyph tables, frame lists, GOP framing.
 * Compression and storage are left to the caller, so the same code serves the Bun encoder (a file on disk)
 * and the browser (a Blob).
 *
 * A GOP is one key frame followed by deltas. A frame lists the cells it changes with their new ids, one plane
 * per field (see `LIST_PLANE`).
 * @param header Stream parameters.
 * @returns `addFrame` and `flush` hand out raw GOPs; `meta` builds the metadata once the index is known.
 */
export const createM2aBuilder = (header: M2aHeader) => {
	const cells = header.cols * header.rows;
	// Id 0 of the character colors is "none", id 0 of the glyphs is the blank.
	const bgTable = createTable<Rgb>(rgbKey);
	const fgTable = createTable<Rgb | null>((value) => (value ? rgbKey(value) : -1), [null]);
	const glyphTable = createTable<string>((value) => value, [" "]);

	let frames = 0;
	let pending: Uint8Array[] = [];
	let previousBg = new Uint16Array(cells);
	let previousFg = new Uint16Array(cells);
	let previousGlyph = new Uint16Array(cells);

	/** Joins the frames collected so far into one GOP. */
	const take = (): RawGop | null => {
		if (pending.length === 0) return null;
		const raw = new Uint8Array(pending.reduce((sum, frame) => sum + frame.byteLength, 0));
		let at = 0;
		for (const frame of pending) {
			raw.set(frame, at);
			at += frame.byteLength;
		}
		const gop = { firstFrame: frames - pending.length, raw };
		pending = [];
		return gop;
	};

	return {
		/**
		 * Adds the next frame; the first frame of every GOP is a key frame.
		 * @returns The GOP this frame completed, or `null` while it is still filling.
		 */
		addFrame(frame: readonly RawCell[]): RawGop | null {
			const bg = new Uint16Array(cells);
			const fg = new Uint16Array(cells);
			const glyph = new Uint16Array(cells);
			frame.forEach((cell, i) => {
				bg[i] = bgTable.idOf(cell.bg);
				fg[i] = fgTable.idOf(cell.fg);
				glyph[i] = glyphTable.idOf(cell.char);
			});
			const key = pending.length === 0;
			// A key frame starts from an empty screen (all ids 0); a delta from the previous frame.
			const listed: number[] = [];
			for (let i = 0; i < cells; i += 1) {
				const [pb, pf, pg] = key ? [0, 0, 0] : [previousBg[i], previousFg[i], previousGlyph[i]];
				if (bg[i] !== pb || fg[i] !== pf || glyph[i] !== pg) listed.push(i);
			}
			const out = new Uint8Array(listBytes(listed.length));
			new DataView(out.buffer).setUint32(0, listed.length, true);
			const n = listed.length;
			let last = -1;
			listed.forEach((cell, j) => {
				const gap = cell - last - 1;
				last = cell;
				const set = (plane: number, offset: number, value: number) => {
					out[COUNT_BYTES + (plane + offset) * n + j] = value;
				};
				set(LIST_PLANE.gap, 0, gap & 0xff);
				set(LIST_PLANE.gap, 1, (gap >> 8) & 0xff);
				set(LIST_PLANE.gap, 2, gap >> 16);
				set(LIST_PLANE.bg, 0, (bg[cell] as number) & 0xff);
				set(LIST_PLANE.bg, 1, (bg[cell] as number) >> 8);
				set(LIST_PLANE.fg, 0, (fg[cell] as number) & 0xff);
				set(LIST_PLANE.fg, 1, (fg[cell] as number) >> 8);
				set(LIST_PLANE.glyph, 0, (glyph[cell] as number) & 0xff);
				set(LIST_PLANE.glyph, 1, (glyph[cell] as number) >> 8);
			});
			pending.push(out);
			previousBg = bg;
			previousFg = fg;
			previousGlyph = glyph;
			frames += 1;
			return pending.length === header.gop ? take() : null;
		},
		/** @returns The last, possibly shorter GOP, or `null` if the previous one ended exactly at the last frame. */
		flush: take,
		/** Metadata for the finished file; `index` lists every GOP in the order they were written. */
		meta(index: GopIndexEntry[]): M2aMeta {
			return {
				...header,
				frames,
				index,
				bg: bgTable.values.map(hex),
				fg: fgTable.values.map((value) => (value ? hex(value) : "#000000")),
				glyphs: glyphTable.values,
			};
		},
	};
};

/**
 * The bytes in front of the data section: the magic line and the metadata line.
 * @param meta Complete metadata.
 * @returns Bytes to write before the GOPs.
 */
export const encodeHead = (meta: M2aMeta): Uint8Array => textEncoder.encode(`${MAGIC}${JSON.stringify(meta)}\n`);
