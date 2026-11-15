import {
	createRateMeter,
	createRollingAverage,
	type RollingAverage,
	timerResolution,
} from "#libs/perf";
import { byId } from "#libs/utils";
import {
	FPS_REFRESH_MS,
	FPS_WINDOW_MS,
	STATS_REFRESH_MS,
	STATS_WINDOW_FRAMES,
} from "./player.constants.ts";

const element = byId<HTMLPreElement>("stats");

export const timings = {
	grab: createRollingAverage(STATS_WINDOW_FRAMES),
	read: createRollingAverage(STATS_WINDOW_FRAMES),
	reduce: createRollingAverage(STATS_WINDOW_FRAMES),
	draw: createRollingAverage(STATS_WINDOW_FRAMES),
};

const resolution = timerResolution();
let lastShownAt = 0;

/**
 * Formats a timing as median and mean.
 * @param label Row title.
 * @param stat Timing to describe.
 * @returns One line of the stats block.
 */
const row = (label: string, stat: RollingAverage): string =>
	`${label.padEnd(8)} median ${stat.median().toFixed(2)} | mean ${stat.value().toFixed(2)} ms`;

/**
 * Shows stage timings on the page, at most every `STATS_REFRESH_MS`.
 * @param header Lines describing the current setup (sampler, sizes).
 */
export const showStats = (header: readonly string[]): void => {
	const now = performance.now();
	if (now - lastShownAt < STATS_REFRESH_MS) return;
	lastShownAt = now;
	const { grab, read, reduce, draw } = timings;
	element.textContent = [
		...header,
		`timer:   ${resolution.toFixed(3)} ms resolution`,
		row("grab", grab),
		row("read", read),
		row("reduce", reduce),
		row("draw", draw),
		`total:   median ${(grab.median() + read.median() + reduce.median() + draw.median()).toFixed(2)} ms`,
	].join("\n");
};

const videoFpsMeter = createRateMeter(FPS_WINDOW_MS);
const canvasFpsMeter = createRateMeter(FPS_WINDOW_MS);
const videoFpsElement = byId<HTMLElement>("videoFps");
const canvasFpsElement = byId<HTMLElement>("canvasFps");
let lastPresentedFrames = 0;
let lastFpsShownAt = 0;

/**
 * Counts a frame the video presented.
 * `presentedFrames` grows by one per decoded frame, so a drop shows up as a jump of more than one.
 * @param now Presentation time in milliseconds.
 * @param presentedFrames Total frames the video has presented so far.
 */
export const countVideoFrame = (now: number, presentedFrames: number): void => {
	// After a seek or a new file the counter restarts, so treat that as one frame.
	const delta =
		presentedFrames > lastPresentedFrames
			? presentedFrames - lastPresentedFrames
			: 1;
	lastPresentedFrames = presentedFrames;
	videoFpsMeter.push(now, delta);
};

/**
 * Counts a frame drawn on the output canvas, and refreshes both badges at most every `FPS_REFRESH_MS`.
 * @param now Draw time in milliseconds.
 */
export const countCanvasFrame = (now: number): void => {
	canvasFpsMeter.push(now);
	if (now - lastFpsShownAt < FPS_REFRESH_MS) return;
	lastFpsShownAt = now;
	videoFpsElement.textContent = `video ${videoFpsMeter.value().toFixed(1)} fps`;
	canvasFpsElement.textContent = `canvas ${canvasFpsMeter.value().toFixed(1)} fps`;
};
