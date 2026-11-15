import { ffmpegScale, ffprobeSize } from "#libs/ffmpeg";
import { chunkFrames } from "#libs/frames";
import type { Config } from "#modules/config";
import { createFrameCells, GOP_SECONDS } from "#modules/transcode";
import { createM2aWriter } from "./m2a.ts";

export const EncoderService = () => {
	return {
		async encode({
			inputPath,
			outputPath,
			fps,
			seed,
			cellAspect,
			contrast,
			gamma,
			luminanceStep,
			deadband,
			look,
		}: Config) {
			const size = await ffprobeSize(inputPath);
			const frameCells = createFrameCells({ size, cellAspect, seed, luminanceStep, deadband, look });
			const { cols, rows } = frameCells;
			const proc = await ffmpegScale({ inputPath, fps, cols, rows, contrast, gamma });
			const stderr = new Response(proc.stderr).text();

			// Frames are written as they arrive, so memory stays flat for long videos.
			const output = await createM2aWriter(outputPath, {
				cols,
				rows,
				fps,
				gop: Math.max(1, Math.round(fps * GOP_SECONDS)),
				cellAspect,
				background: look.backgroundColor,
			});
			let frames = 0;
			let litCells = 0;
			for await (const frame of chunkFrames(proc.stdout, cols * rows)) {
				const { cells, lit } = frameCells.next(frame);
				litCells += lit;
				output.addFrame(cells);
				frames += 1;
			}

			const { bytes } = await output.finish();
			const exitCode = await proc.exited;
			if (exitCode !== 0) throw new Error(await stderr);

			console.log(
				`${size.width}x${size.height} -> ${cols}x${rows}, ${frames} frames, ${litCells} lit cells -> ${outputPath} (${(bytes / 1e6).toFixed(1)} MB)`,
			);
		},
	};
};
