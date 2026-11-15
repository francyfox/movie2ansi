import { mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createM2aBuilder, encodeHead, type GopIndexEntry, type M2aHeader, type RawGop } from "#modules/m2a";

export type { RawCell } from "#modules/m2a";

/**
 * Writes an `.m2a` file: magic line, one JSON metadata line (stream parameters, frame count, GOP index, color
 * and glyph tables), then the gzip-compressed GOPs.
 *
 * The metadata is only complete after the last frame, so GOPs are streamed to `<path>.tmp` as they are ready
 * (memory stays flat) and the final file is assembled in `finish`, with the metadata in front.
 * The format itself is built by `createM2aBuilder`, which the browser encoder shares.
 * @param path Output file; missing folders are created, an existing file is replaced.
 * @param header Stream parameters.
 * @returns Writer with `addFrame` and `finish`.
 */
export const createM2aWriter = async (path: string, header: M2aHeader) => {
	await mkdir(dirname(path), { recursive: true });
	// `writer()` does not truncate: a shorter file would keep the tail of the previous, longer one.
	await Bun.write(path, "");
	const dataPath = `${path}.tmp`;
	await Bun.write(dataPath, "");
	const sink = Bun.file(dataPath).writer();
	// Offsets count from the start of the data section, which is where `dataPath` starts.
	let offset = 0;

	const builder = createM2aBuilder(header);
	const index: GopIndexEntry[] = [];

	const write = (gop: RawGop | null): void => {
		if (!gop) return;
		const packed = Bun.gzipSync(gop.raw);
		sink.write(packed);
		index.push({ firstFrame: gop.firstFrame, offset, length: packed.byteLength });
		offset += packed.byteLength;
	};

	return {
		/** Adds the next frame; the first frame of every GOP is a key frame. */
		addFrame(frame: Parameters<typeof builder.addFrame>[0]): void {
			write(builder.addFrame(frame));
		},
		/** Writes the last GOP, assembles the final file with the metadata in front, and removes the temp file. */
		async finish(): Promise<{ frames: number; bytes: number }> {
			write(builder.flush());
			await sink.end();
			const meta = builder.meta(index);
			const head = encodeHead(meta);
			const out = Bun.file(path).writer();
			out.write(head);
			const reader = Bun.file(dataPath).stream().getReader();
			for (let part = await reader.read(); !part.done; part = await reader.read()) out.write(part.value);
			await out.end();
			await unlink(dataPath);
			return { frames: meta.frames, bytes: head.byteLength + offset };
		},
	};
};
