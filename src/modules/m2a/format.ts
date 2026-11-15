/** First line of every `.m2a` file. The digit is the format version. */
export const MAGIC = "M2A2\n";

/**
 * A frame lists the cells it changes, and for each one its new ids. Layout (all numbers little-endian):
 *
 *   count: u32, then `LIST_PLANES` planes of `count` bytes each:
 *   gap (3 bytes, low to high), bg id (2), character-color id (2), glyph id (2).
 *
 * `gap` is the distance from the previous listed cell (the first counts from -1), so a cell index is a running
 * sum. Each field has its own plane, so similar bytes sit together and the high bytes, mostly zero, are cheap.
 * A key frame lists every cell with non-zero ids, and the decoder starts it from an empty screen; a delta
 * lists only cells that changed, with their new values (not a difference: new values repeat, differences don't).
 */
export const COUNT_BYTES = 4;
export const LIST_PLANE = { gap: 0, bg: 3, fg: 5, glyph: 7 } as const;
export const LIST_PLANES = 9;

/** Ids are 16 bits wide. */
export const MAX_ID = 0xffff;

/** Known before encoding starts. `frames` is not here: it is only exact at the end, so it goes to the trailer. */
export interface M2aHeader {
	cols: number;
	rows: number;
	fps: number;
	/** Frames per GOP. */
	gop: number;
	/** Cell width divided by cell height. */
	cellAspect: number;
	/** Hex color of the plain background. */
	background: string;
}

/** Where one GOP lives in the file. */
export interface GopIndexEntry {
	firstFrame: number;
	/** Bytes from the start of the data section (the first byte after the metadata line), not of the file. */
	offset: number;
	length: number;
}

/**
 * Everything about the file, written as one JSON line right after the magic line:
 * the stream parameters from the encoder's start, and what is only known once the last frame is encoded
 * (frame count, GOP index, color and glyph tables). The encoder writes frames to a temporary file and
 * assembles the final one at the end, so all of this comes before the data and a reader can start from the
 * first bytes. Offsets are relative to the data section, because the length of this line depends on them.
 */
export interface M2aMeta extends M2aHeader {
	frames: number;
	index: GopIndexEntry[];
	/** Background colors by id, `#rrggbb`. */
	bg: string[];
	/** Character colors by id; id 0 means "no color" and is used by blank cells. */
	fg: string[];
	/** Glyphs by id; id 0 is the blank. */
	glyphs: string[];
}

/** Bytes of a frame that lists `count` cells. */
export const listBytes = (count: number): number => COUNT_BYTES + count * LIST_PLANES;
