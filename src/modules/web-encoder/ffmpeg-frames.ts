import type { Size } from "#libs/geometry";
import coreUrl from "@ffmpeg/core" with { type: "file" };
import wasmUrl from "@ffmpeg/core/wasm" with { type: "file" };
import workerFile from "./ffmpeg.worker.js" with { type: "text" };
import { parseVideoInfo } from "./probe-log.ts";

/** A video opened in ffmpeg.wasm. */
export interface FfmpegVideo {
	size: Size;
	duration: number;
	/**
	 * Decodes the whole video to gray frames, one byte per cell, frame after frame.
	 * @param fps Output frame rate.
	 * @param cols Grid width.
	 * @param rows Grid height.
	 * @param onProgress Called with a ratio from 0 to 1 while decoding.
	 * @returns `frames * cols * rows` bytes.
	 */
	decode: (filter: string, onProgress?: (ratio: number) => void) => Promise<Uint8Array>;
	/** Stops the worker; a decode in progress never finishes. */
	close: () => void;
}

/**
 * The worker is a plain JS file (see its header), imported as text and started from a Blob URL.
 * As a copied asset it broke under `bun --hot`: after the file was edited the dev server served it as a module.
 * TypeScript types the import as the file's module, the bundler returns its text.
 */
const workerSource = workerFile as unknown as string;

const absolute = (url: string): string => new URL(url, document.baseURI).href;

/**
 * Opens a video in ffmpeg.wasm, which runs in a worker so the page stays responsive.
 * The file is read lazily from disk, not copied into memory.
 * The first call downloads the ffmpeg core (about 30 MB, then cached by the browser).
 * @param file Video chosen by the user.
 * @returns The opened video.
 */
export const openFfmpegVideo = async (file: Blob): Promise<FfmpegVideo> => {
	const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
	const worker = new Worker(workerUrl, { type: "module" });
	URL.revokeObjectURL(workerUrl);
	/** Next message of the given kind; a worker error rejects. */
	const next = <T>(type: string, onProgress?: (message: { ratio: number }) => void): Promise<T> =>
		new Promise((resolve, reject) => {
			const listener = ({ data }: MessageEvent) => {
				if (data.type === "progress") onProgress?.(data);
				else if (data.type === "error") {
					worker.removeEventListener("message", listener);
					reject(new Error(data.message));
				} else if (data.type === type) {
					worker.removeEventListener("message", listener);
					resolve(data);
				}
			};
			worker.addEventListener("message", listener);
		});

	try {
		const opened = next<{ log: string }>("opened");
		worker.postMessage({ type: "open", coreUrl: absolute(coreUrl), wasmUrl: absolute(wasmUrl), file });
		const { size, duration } = parseVideoInfo((await opened).log);
		return {
			size,
			duration,
			async decode(filter, onProgress) {
				const done = next<{ gray: Uint8Array }>("done", ({ ratio }) => onProgress?.(Math.min(1, Math.max(0, ratio))));
				worker.postMessage({ type: "convert", filter });
				return (await done).gray;
			},
			close: () => worker.terminate(),
		};
	} catch (error) {
		worker.terminate();
		throw error;
	}
};
