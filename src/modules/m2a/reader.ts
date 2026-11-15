import { gunzip } from "./gzip.ts";
import { type GopIndexEntry, listBytes, MAGIC, type M2aHeader, type M2aMeta } from "./format.ts";

const decoder = new TextDecoder();

/** An opened `.m2a` file: metadata is parsed, GOPs are decompressed on demand. */
export interface M2aFile {
	header: M2aHeader;
	frames: number;
	/** Length in seconds. */
	duration: number;
	index: readonly GopIndexEntry[];
	/** Background colors by id, as CSS colors. */
	bg: readonly string[];
	/** Character colors by id, as CSS colors. */
	fg: readonly string[];
	/** Glyphs by id. */
	glyphs: readonly string[];
	/** Decompresses one GOP into its frames: a key frame, then deltas. */
	readGop: (gop: number) => Promise<Uint8Array[]>;
}

/**
 * Parses the metadata line of an `.m2a` file. GOPs stay compressed until {@link M2aFile.readGop}.
 * @param buffer The whole file, or at least everything up to the end of the metadata line and the GOPs to read.
 * @returns The opened file.
 * @throws If the magic line or the metadata line is missing.
 */
export const openM2a = (buffer: ArrayBuffer): M2aFile => {
	const bytes = new Uint8Array(buffer);
	if (decoder.decode(bytes.subarray(0, MAGIC.length)) !== MAGIC) throw new Error(`Not an ${MAGIC.trim()} file`);
	const metaEnd = bytes.indexOf(10, MAGIC.length);
	if (metaEnd < 0) throw new Error("Truncated M2A file");

	const meta: M2aMeta = JSON.parse(decoder.decode(bytes.subarray(MAGIC.length, metaEnd)));
	const dataStart = metaEnd + 1;
	const { frames, index, bg, fg, glyphs, ...header } = meta;

	return {
		header: header as M2aHeader,
		frames,
		duration: frames / meta.fps,
		index,
		bg,
		fg,
		glyphs,
		readGop: async (gop) => {
			const entry = index[gop];
			if (!entry) throw new RangeError(`No GOP ${gop}`);
			const from = dataStart + entry.offset;
			const raw = await gunzip(bytes.subarray(from, from + entry.length));
			// Each frame starts with the number of cells it lists, which gives its length.
			const list: Uint8Array[] = [];
			const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
			for (let at = 0; at < raw.byteLength; ) {
				const length = listBytes(view.getUint32(at, true));
				list.push(raw.subarray(at, at + length));
				at += length;
			}
			return list;
		},
	};
};
