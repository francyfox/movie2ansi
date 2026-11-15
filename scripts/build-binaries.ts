/**
 * Compiles the command-line tools into standalone executables (no Bun or node_modules needed to run them),
 * for Linux and macOS (darwin), x64 and arm64, all at once.
 *
 *   bun run build:bin                 -> dist/bin/m2a-play-linux-x64, …-linux-arm64, …-darwin-x64, …-darwin-arm64,
 *                                        and the same four for m2a-encode
 *   bun run build:bin --only play     -> just the terminal player (or `encode`)
 *   bun run build:bin --os darwin     -> just one system (linux or darwin)
 *   bun run build:bin --arch arm64    -> just one architecture
 *   bun run build:bin -o build/bin    -> another folder
 *
 * Building for another system or architecture than this machine's downloads that Bun runtime once, so it needs network.
 * `m2a-encode` still calls the system `ffmpeg` and `ffprobe`, which have to be installed where it runs.
 */
import { parseArgs } from "node:util";

const TOOLS = {
	play: { entry: "./src/play.ts", name: "m2a-play" },
	encode: { entry: "./src/encode.ts", name: "m2a-encode" },
} as const;
const SYSTEMS = ["linux", "darwin"] as const;
const ARCHS = ["x64", "arm64"] as const;

type Tool = keyof typeof TOOLS;
type System = (typeof SYSTEMS)[number];
type Arch = (typeof ARCHS)[number];

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		out: { type: "string", short: "o", default: "dist/bin" },
		only: { type: "string" },
		os: { type: "string" },
		arch: { type: "string" },
	},
});

const isTool = (name: string): name is Tool => name in TOOLS;
const isSystem = (name: string): name is System => (SYSTEMS as readonly string[]).includes(name);
const isArch = (name: string): name is Arch => (ARCHS as readonly string[]).includes(name);
if (values.only !== undefined && !isTool(values.only)) {
	console.error(`--only takes ${Object.keys(TOOLS).join(" or ")}, got "${values.only}"`);
	process.exit(1);
}
if (values.os !== undefined && !isSystem(values.os)) {
	console.error(`--os takes ${SYSTEMS.join(" or ")}, got "${values.os}"`);
	process.exit(1);
}
if (values.arch !== undefined && !isArch(values.arch)) {
	console.error(`--arch takes ${ARCHS.join(" or ")}, got "${values.arch}"`);
	process.exit(1);
}
const tools = Object.keys(TOOLS).filter(isTool).filter((tool) => values.only === undefined || tool === values.only);
const systems = SYSTEMS.filter((system) => values.os === undefined || system === values.os);
const archs = ARCHS.filter((arch) => values.arch === undefined || arch === values.arch);

let failed = false;
for (const tool of tools) {
	for (const system of systems) {
		for (const arch of archs) {
			const { entry, name } = TOOLS[tool];
			const outfile = `${values.out}/${name}-${system}-${arch}`;
			const result = await Bun.build({
				entrypoints: [entry],
				target: "bun",
				minify: true,
				compile: { outfile, target: `bun-${system}-${arch}` },
			});
			if (!result.success) {
				failed = true;
				for (const log of result.logs) console.error(log);
				continue;
			}
			console.log(`${outfile}  ${(Bun.file(outfile).size / 1e6).toFixed(1)} MB`);
		}
	}
}
process.exit(failed ? 1 : 0);
