import { createM2aBuilder, encodeHead, type RawGop } from "./builder.ts";
import type { GopIndexEntry, M2aHeader } from "./format.ts";
import { gzip } from "./gzip.ts";

/**
 * Builds an `.m2a` file in memory, for the browser. Same bytes as the file writer, only the GOPs are
 * compressed with the platform's `CompressionStream` and the result is a `Blob`.
 * @param header Stream parameters.
 * @returns Writer with `addFrame` (await it: a finished GOP is compressed there) and `finish`.
 */
export const createM2aBlobWriter = (header: M2aHeader) => {
	const builder = createM2aBuilder(header);
	const index: GopIndexEntry[] = [];
	const chunks: Uint8Array[] = [];
	let offset = 0;

	const write = async (gop: RawGop | null): Promise<void> => {
		if (!gop) return;
		const packed = await gzip(gop.raw);
		chunks.push(packed);
		index.push({ firstFrame: gop.firstFrame, offset, length: packed.byteLength });
		offset += packed.byteLength;
	};

	return {
		addFrame: (frame: Parameters<typeof builder.addFrame>[0]): Promise<void> => write(builder.addFrame(frame)),
		async finish(): Promise<{ blob: Blob; frames: number }> {
			await write(builder.flush());
			const meta = builder.meta(index);
			return { blob: new Blob([encodeHead(meta) as BlobPart, ...(chunks as BlobPart[])]), frames: meta.frames };
		},
	};
};
