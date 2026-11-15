/**
 * Bundles the `<ansi-player>` web component into one file, without the rest of the app.
 *
 *   bun run build:player                 -> dist/ansi-player.js (minified)
 *   bun run build:player --dev           -> readable, with an inline source map
 *   bun run build:player --out build/x   -> another folder
 *
 * The file registers the tag on load: `<script type="module" src="ansi-player.js">`, then
 * `<ansi-player src="movie.m2a" controls autoplay loop>`.
 */
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

const ENTRY = "./src/modules/ansi-player/index.ts";

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		out: { type: "string", short: "o", default: "dist" },
		dev: { type: "boolean", default: false },
	},
});

const result = await Bun.build({
	entrypoints: [ENTRY],
	outdir: values.out,
	naming: "ansi-player.js",
	target: "browser",
	format: "esm",
	minify: !values.dev,
	sourcemap: values.dev ? "inline" : "none",
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

for (const output of result.outputs) {
	const bytes = new Uint8Array(await output.arrayBuffer());
	console.log(
		`${output.path.replace(`${process.cwd()}/`, "")}  ${(bytes.byteLength / 1024).toFixed(1)} KB, ${(gzipSync(bytes).byteLength / 1024).toFixed(1)} KB gzipped`,
	);
}
