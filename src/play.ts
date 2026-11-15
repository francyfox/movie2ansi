import { parseArgs } from "node:util";
import { hexToRgb } from "#libs/color";
import { DEFAULT_CONFIG_PATH, loadConfig } from "#modules/config";
import { createCellDecoder, openM2a } from "#modules/m2a";
import { type AnsiCell, ansiCell, deltaFrame, keyFrame } from "./modules/encoder/ansi.ts";

const ENTER = "\x1b[?1049h\x1b[?25l\x1b[2J"; // alternate screen, hide cursor, clear
const LEAVE = "\x1b[0m\x1b[?25h\x1b[?1049l";

const { values, positionals } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		config: { type: "string", short: "c", default: DEFAULT_CONFIG_PATH },
		loop: { type: "boolean", short: "l", default: false },
	},
	allowPositionals: true,
});

// A file argument wins; otherwise play whatever the encoder config writes to.
const path = positionals[0] ?? (await loadConfig(values.config)).outputPath;
const file = openM2a(await Bun.file(path).arrayBuffer());
const { cols, rows, fps } = file.header;

const { columns = 0, rows: terminalRows = 0 } = process.stdout;
if (columns < cols || terminalRows < rows)
	console.error(
		`Terminal is ${columns}x${terminalRows}, the video is ${cols}x${rows}: shrink the font or encode a smaller grid.`,
	);

const bg = file.bg.map(hexToRgb);
const fg = file.fg.map(hexToRgb);
const screen = createCellDecoder(cols * rows);

/** The screen as ANSI cells, for the terminal writer. */
const snapshot = (): AnsiCell[] =>
	Array.from({ length: cols * rows }, (_, i) => {
		const char = file.glyphs[screen.glyph(i)] ?? " ";
		return ansiCell(bg[screen.bg(i)] ?? { r: 0, g: 0, b: 0 }, char === " " ? null : (fg[screen.fg(i)] ?? null), char);
	});

let stopped = false;
const stop = (): void => {
	stopped = true;
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

process.stdout.write(ENTER);
try {
	do {
		const startedAt = performance.now();
		let shown = 0;
		let previous: AnsiCell[] = [];
		for (let gop = 0; gop < file.index.length && !stopped; gop += 1) {
			for (const [k, frame] of (await file.readGop(gop)).entries()) {
				if (stopped) break;
				screen.apply(frame, k === 0, new Set());
				// Wait for this frame's slot on the clock, so a slow terminal drops delay, not speed.
				const wait = startedAt + (shown * 1000) / fps - performance.now();
				if (wait > 0) await Bun.sleep(wait);
				const cells = snapshot();
				// Key frames repaint everything; deltas send only the cells that changed.
				process.stdout.write(k === 0 ? keyFrame(cells, cols) : deltaFrame(previous, cells, cols));
				previous = cells;
				shown += 1;
			}
		}
	} while (values.loop && !stopped);
} finally {
	process.stdout.write(LEAVE);
}
