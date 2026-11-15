// Runs ffmpeg.wasm off the main thread. A plain file on purpose: it is imported as text and started from a
// Blob URL, and loads the core by URL (`import()`) instead of bundling it. Messages, in order:
//   main -> { type: "open", coreUrl, wasmUrl, file }       worker -> { type: "opened", log }
//   main -> { type: "convert", fps, cols, rows }           worker -> { type: "progress", ratio } …, { type: "done", gray }
// Any failure is answered with { type: "error", message }.

/** @type {any} */
let core = null;

/** Mounts `file` read-only at /in without copying it into memory. */
const mount = (file) => {
	core.FS.mkdir("/in");
	core.FS.mount(core.FS.filesystems.WORKERFS, { blobs: [{ name: "input", data: file }] }, "/in");
};

/** Runs ffmpeg and returns its exit code and everything it logged. */
const run = (...args) => {
	const lines = [];
	core.setLogger(({ message }) => lines.push(message));
	const code = core.exec(...args);
	core.reset();
	return { code, log: lines.join("\n") };
};

const handlers = {
	async open({ coreUrl, wasmUrl, file }) {
		const { default: createCore } = await import(coreUrl);
		// The core has its own `locateFile`, which ignores ours: it reads the wasm address from the hash of this URL
		// (the same convention @ffmpeg/ffmpeg uses). Without it the core looks for `ffmpeg-core.wasm` next to its script.
		core = await createCore({ mainScriptUrlOrBlob: `${coreUrl}#${btoa(JSON.stringify({ wasmURL: wasmUrl }))}` });
		mount(file);
		// No output file: ffmpeg describes the input and then fails, which is fine here.
		postMessage({ type: "opened", log: run("-i", "/in/input").log });
	},
	convert({ filter }) {
		core.setProgress(({ progress }) => postMessage({ type: "progress", ratio: progress }));
		const { code, log } = run(
			"-hide_banner",
			"-loglevel",
			"error",
			"-i",
			"/in/input",
			"-an",
			"-vf",
			filter,
			"-f",
			"rawvideo",
			"/out.raw",
		);
		if (code !== 0) throw new Error(log || `ffmpeg exited with ${code}`);
		// A copy, so its buffer can be handed over instead of cloned.
		const gray = new Uint8Array(core.FS.readFile("/out.raw"));
		core.FS.unlink("/out.raw");
		postMessage({ type: "done", gray }, [gray.buffer]);
	},
};

self.onmessage = async ({ data }) => {
	try {
		await handlers[data.type](data);
	} catch (error) {
		postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
	}
};
