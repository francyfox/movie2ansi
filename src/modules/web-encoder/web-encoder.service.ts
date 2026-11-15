import { videoFilter } from "#libs/video-filter";
import { createM2aBlobWriter } from "#modules/m2a";
import type { Settings } from "#modules/settings";
import { createFrameCells, GOP_SECONDS } from "#modules/transcode";
import { openFfmpegVideo } from "./ffmpeg-frames.ts";

/** Frames turned into cells between two breaks that let the page redraw. */
const FRAMES_PER_BREAK = 8;

export interface WebEncodeOptions {
	/** Output frame rate. */
	fps: number;
	seed: number;
	/** Cell width divided by cell height. */
	cellAspect: number;
	/** ffmpeg contrast, 1 = unchanged. */
	contrast: number;
	/** ffmpeg gamma, 1 = unchanged. */
	gamma: number;
	luminanceStep: number;
	deadband: number;
	look: Readonly<Settings>;
}

export type WebEncodeStage = "decode" | "encode";

export interface WebEncodeHooks {
	/** `decode`: ffmpeg is reading the video (`done` and `total` are a ratio out of 1); `encode`: frames done out of all. */
	onProgress?: (stage: WebEncodeStage, done: number, total: number) => void;
	/** Aborting stops the conversion; the returned promise rejects with the signal's reason. */
	signal?: AbortSignal;
}

export interface WebEncodeResult {
	/** The finished `.m2a` file. */
	blob: Blob;
	frames: number;
	litCells: number;
	cols: number;
	rows: number;
}

/**
 * Converts a video to `.m2a` inside the browser: nothing is uploaded anywhere.
 * ffmpeg.wasm decodes and scales the video in a worker, with the same filter chain as the Bun encoder
 * (`fps`, `scale … area`, `format=gray`); the cells and the file format are the same code too.
 * @param file Video chosen by the user.
 * @param options Frame rate and look.
 * @param hooks Progress and cancellation.
 * @returns The file and a few numbers about it.
 */
export const encodeVideo = async (
	file: Blob,
	options: WebEncodeOptions,
	{ onProgress, signal }: WebEncodeHooks = {},
): Promise<WebEncodeResult> => {
	signal?.throwIfAborted();
	const video = await openFfmpegVideo(file);
	// Terminating the worker is the only way to stop ffmpeg in the middle of a run.
	const stop = () => video.close();
	signal?.addEventListener("abort", stop, { once: true });
	try {
		const { fps } = options;
		const frameCells = createFrameCells({ ...options, size: video.size });
		const { cols, rows } = frameCells;
		const gray = await video.decode(videoFilter({ fps, cols, rows, contrast: options.contrast, gamma: options.gamma }), (ratio) => onProgress?.("decode", ratio, 1));
		signal?.throwIfAborted();

		const total = gray.length / (cols * rows);
		const output = createM2aBlobWriter({
			cols,
			rows,
			fps,
			gop: Math.max(1, Math.round(fps * GOP_SECONDS)),
			cellAspect: options.cellAspect,
			background: options.look.backgroundColor,
		});
		let litCells = 0;
		for (let frame = 0; frame < total; frame += 1) {
			signal?.throwIfAborted();
			const { cells, lit } = frameCells.next(gray.subarray(frame * cols * rows, (frame + 1) * cols * rows));
			litCells += lit;
			await output.addFrame(cells);
			if (frame % FRAMES_PER_BREAK === 0) {
				onProgress?.("encode", frame + 1, total);
				await new Promise((resolve) => setTimeout(resolve));
			}
		}
		const { blob, frames } = await output.finish();
		return { blob, frames, litCells, cols, rows };
	} finally {
		signal?.removeEventListener("abort", stop);
		video.close();
	}
};
