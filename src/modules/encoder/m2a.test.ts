import { expect, test } from "bun:test";
import { type AnsiCell, deltaFrame, keyFrame } from "./ansi.ts";
import { createCellDecoder, openM2a } from "#modules/m2a";
import { createM2aWriter, type RawCell } from "./m2a.ts";

const ESC = String.fromCharCode(27);
const COLS = 5;
const ROWS = 3;
const PATH = `${process.env.TMPDIR ?? "/tmp"}/m2a-test-${process.pid}.m2a`;

/** Deterministic pseudo-random frames where only some cells change between frames. */
const makeFrames = (count: number): AnsiCell[][] => {
	let seed = 7;
	const next = (): number => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed / 2 ** 31;
	};
	let cells: AnsiCell[] = Array.from({ length: COLS * ROWS }, () => ({
		bg: "\x1b[48;2;1;2;3m",
		fg: "",
		char: " ",
	}));
	return Array.from({ length: count }, () => {
		cells = cells.map((cell) => {
			if (next() >= 0.3) return cell;
			// Like the encoder: a visible character always has a color, a blank never does.
			const lit = next() < 0.5;
			return {
				bg: `\x1b[48;2;${Math.floor(next() * 4)};0;0m`,
				fg: lit ? `\x1b[38;2;0;${Math.floor(next() * 4)};9m` : "",
				char: lit ? "a" : " ",
			};
		});
		return cells;
	});
};

/** Mini terminal: runs the subset of ANSI the format uses and returns the grid. */
const play = (grid: AnsiCell[], text: string): AnsiCell[] => {
	const out = grid.map((cell) => ({ ...cell }));
	let bg = "";
	let fg = "";
	let at = 0;
	const tokens = new RegExp(`${ESC}\\[(\\d*)(?:;(\\d+))?(?:;(\\d+);(\\d+);(\\d+))?([Hm])|\\n|([^${ESC}\\n])`, "g");
	for (const m of text.matchAll(tokens)) {
		const [whole, a, b, r, g, bl, kind, char] = m;
		if (char !== undefined) {
			out[at] = { bg, fg: char === " " ? "" : fg, char };
			at += 1;
		} else if (whole === "\n") {
			// rows end exactly at the last column, so the cursor is already on the next row
		} else if (kind === "H") at = a ? (Number(a) - 1) * COLS + (Number(b) - 1) : 0;
		else if (a === "0" && b === undefined) {
			bg = "";
			fg = "";
		} else if (a === "48") bg = `\x1b[48;2;${r};${g};${bl}m`;
		else if (a === "38") fg = `\x1b[38;2;${r};${g};${bl}m`;
	}
	return out;
};

test("terminal output: key frame then deltas reproduce every frame", () => {
	const frames = makeFrames(20);
	let screen: AnsiCell[] = (frames[0] ?? []).map(() => ({ bg: "", fg: "", char: " " }));
	frames.forEach((cells, i) => {
		const text = i === 0 ? keyFrame(cells, COLS) : deltaFrame(frames[i - 1] ?? [], cells, COLS);
		screen = play(screen, text);
		expect(screen.map((c) => [c.bg, c.char === " " ? "" : c.fg, c.char])).toEqual(
			cells.map((c) => [c.bg, c.char === " " ? "" : c.fg, c.char]),
		);
	});
});

const rgb = (r: number, g: number, b: number) => ({ r, g, b });

/** Frames of raw cells where about a quarter of the cells change from one frame to the next. */
const makeRawFrames = (count: number): RawCell[][] => {
	let seed = 5;
	const next = (): number => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed / 2 ** 31;
	};
	let cells: RawCell[] = Array.from({ length: COLS * ROWS }, () => ({ bg: rgb(1, 2, 3), fg: null, char: " " }));
	return Array.from({ length: count }, () => {
		cells = cells.map((cell) => {
			if (next() >= 0.25) return cell;
			const lit = next() < 0.5;
			// 300 distinct backgrounds: more than a byte holds, so the high plane is really used.
			return {
				bg: rgb(Math.floor(next() * 300) % 256, Math.floor(next() * 300) >> 8, 0),
				fg: lit ? rgb(9, Math.floor(next() * 5), 9) : null,
				char: lit ? "@%&"[Math.floor(next() * 3)] ?? "@" : " ",
			};
		});
		return cells;
	});
};

const HEADER = { cols: COLS, rows: ROWS, fps: 30, gop: 4, cellAspect: 1, background: "#010203" };
const hex = (c: { r: number; g: number; b: number }) =>
	`#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

test("file: every frame survives write, read and decode, in any GOP order", async () => {
	const frames = makeRawFrames(11);
	const writer = await createM2aWriter(PATH, HEADER);
	for (const cells of frames) writer.addFrame(cells);
	const { frames: count, bytes } = await writer.finish();
	const buffer = await Bun.file(PATH).arrayBuffer();
	expect(count).toBe(11);
	expect(buffer.byteLength).toBe(bytes);

	const file = openM2a(buffer);
	expect(file.index.map((e) => e.firstFrame)).toEqual([0, 4, 8]);
	expect(file.glyphs[0]).toBe(" ");
	expect(file.fg[0]).toBe("#000000");

	const check = (screen: ReturnType<typeof createCellDecoder>, want: RawCell[]) => {
		for (const [i, cell] of want.entries()) {
			expect(file.bg[screen.bg(i)]).toBe(hex(cell.bg));
			expect(file.glyphs[screen.glyph(i)]).toBe(cell.char);
			if (cell.fg) expect(file.fg[screen.fg(i)]).toBe(hex(cell.fg));
		}
	};
	const play = async (gop: number, screen: ReturnType<typeof createCellDecoder>) => {
		for (const [k, frame] of (await file.readGop(gop)).entries()) {
			screen.apply(frame, k === 0, new Set());
			check(screen, frames[gop * 4 + k] as RawCell[]);
		}
	};
	// Forward through the file, then jump back onto a dirty screen: a key frame alone must rebuild it.
	const screen = createCellDecoder(COLS * ROWS);
	for (const gop of [0, 1, 2, 0, 2, 1]) await play(gop, screen);
});

test("changed lists exactly the cells whose ids changed", async () => {
	const frames = makeRawFrames(3);
	const writer = await createM2aWriter(PATH, { ...HEADER, gop: 3 });
	for (const cells of frames) writer.addFrame(cells);
	await writer.finish();
	const file = openM2a(await Bun.file(PATH).arrayBuffer());
	const screen = createCellDecoder(COLS * ROWS);
	const [key, delta1] = await file.readGop(0);
	screen.apply(key as Uint8Array, true, new Set());
	const changed = new Set<number>();
	screen.apply(delta1 as Uint8Array, false, changed);
	const expected = (frames[1] as RawCell[])
		.map((cell, i) => ({ cell, before: (frames[0] as RawCell[])[i] as RawCell, i }))
		.filter(({ cell, before }) => hex(cell.bg) !== hex(before.bg) || cell.char !== before.char || (cell.fg && before.fg ? hex(cell.fg) !== hex(before.fg) : cell.fg !== before.fg))
		.map(({ i }) => i);
	expect([...changed].sort((a, b) => a - b)).toEqual(expected);
});

test("a shorter file replaces a longer one instead of keeping its tail", async () => {
	for (const count of [30, 4]) {
		const writer = await createM2aWriter(PATH, HEADER);
		for (const cells of makeRawFrames(count)) writer.addFrame(cells);
		const { bytes } = await writer.finish();
		expect((await Bun.file(PATH).arrayBuffer()).byteLength).toBe(bytes);
	}
});

test("metadata comes first, offsets count from the data section, and no temp file is left", async () => {
	const frames = makeRawFrames(9);
	const writer = await createM2aWriter(PATH, HEADER);
	for (const cells of frames) writer.addFrame(cells);
	await writer.finish();

	const bytes = new Uint8Array(await Bun.file(PATH).arrayBuffer());
	expect(await Bun.file(`${PATH}.tmp`).exists()).toBe(false);
	// Line 1 is the magic, line 2 holds everything a reader needs before the data.
	const lines = new TextDecoder().decode(bytes.subarray(0, bytes.indexOf(0x1f))).split("\n");
	const meta = JSON.parse(lines[1] as string);
	expect(meta.frames).toBe(9);
	expect(meta.index.map((e: { offset: number }) => e.offset)[0]).toBe(0);
	// The last GOP ends exactly at the end of the file.
	const last = meta.index.at(-1);
	const dataStart = (lines[0] as string).length + 1 + (lines[1] as string).length + 1;
	expect(dataStart + last.offset + last.length).toBe(bytes.byteLength);
});
