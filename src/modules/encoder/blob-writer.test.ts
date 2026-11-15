import { expect, test } from "bun:test";
import { createM2aBlobWriter, openM2a, type RawCell } from "#modules/m2a";
import { createFrameCells } from "#modules/transcode";
import { DEFAULT_SETTINGS } from "#modules/settings";
import { createM2aWriter } from "./m2a.ts";

const PATH = `${process.env.TMPDIR ?? "/tmp"}/m2a-blob-test-${process.pid}.m2a`;

/** Deterministic gray frames with moving stripes, so cells really change between frames. */
const grayFrames = (cols: number, rows: number, count: number): Uint8Array[] =>
	Array.from({ length: count }, (_, f) =>
		Uint8Array.from({ length: cols * rows }, (_, i) => ((((i % cols) + f * 2) % 12) * 21) & 255),
	);

const look = { ...DEFAULT_SETTINGS, pixelSizeFactor: 20 };

test("the browser writer produces the same file content as the Bun writer", async () => {
	const options = { size: { width: 200, height: 100 }, cellAspect: 1, seed: 3, luminanceStep: 4, deadband: 2, look };
	const header = (cols: number, rows: number) => ({ cols, rows, fps: 10, gop: 4, cellAspect: 1, background: look.backgroundColor });

	const a = createFrameCells(options);
	const b = createFrameCells(options);
	const frames = grayFrames(a.cols, a.rows, 11);
	const fileWriter = await createM2aWriter(PATH, header(a.cols, a.rows));
	const blobWriter = createM2aBlobWriter(header(b.cols, b.rows));
	for (const gray of frames) {
		fileWriter.addFrame(a.next(gray).cells as RawCell[]);
		await blobWriter.addFrame(b.next(gray).cells);
	}
	await fileWriter.finish();
	const { blob, frames: count } = await blobWriter.finish();
	expect(count).toBe(11);

	const fromFile = openM2a(await Bun.file(PATH).arrayBuffer());
	const fromBlob = openM2a(await blob.arrayBuffer());
	expect(fromBlob.glyphs).toEqual(fromFile.glyphs);
	expect(fromBlob.bg).toEqual(fromFile.bg);
	expect(fromBlob.fg).toEqual(fromFile.fg);
	expect(fromBlob.index.map((e) => e.firstFrame)).toEqual([0, 4, 8]);
	for (let gop = 0; gop < 3; gop += 1) {
		expect(await fromBlob.readGop(gop)).toEqual(await fromFile.readGop(gop));
	}
});
