import { hasArea, type Size } from "#libs/geometry";
import { measure } from "#libs/perf";
import { byId } from "#libs/utils";
import {
	computeLayout,
	createRain,
	createScene,
	drawAscii,
	gridLuminance,
	type LuminanceGrid,
	type RainColumns,
	type Scene,
	toStyle,
} from "#modules/ascii";
import {
	canvas,
	canvasSize,
	ctx,
	drawCells,
	drawImage,
	readCells,
	resizeCanvas,
} from "#modules/canvas";
import { getSettings, type Settings, updateSettings } from "#modules/settings";
import { hasFrame, loadVideoFile, video, watchFrames } from "#modules/video";
import type { FrameListener } from "./player.types.ts";
import {
	countCanvasFrame,
	countVideoFrame,
	showStats,
	timings,
} from "./stats.ts";
import defaultVideoUrl from "../../public/megumin.mp4";

const settings = getSettings();

const state = {
	style: toStyle(settings),
	layout: computeLayout(
		canvasSize(),
		settings.pixelSizeFactor,
		settings.effectWidth / 100,
	),
	rain: [] as RainColumns,
	frame: 0,
	listeners: new Set<FrameListener>(),
};

/**
 * Re-reads the settings and rebuilds style, layout and rain columns from scratch.
 */
const refresh = (): void => {
	const current = getSettings();
	state.style = toStyle(current);
	state.layout = computeLayout(
		canvasSize(),
		current.pixelSizeFactor,
		current.effectWidth / 100,
	);
	state.rain = createRain(state.layout, state.style.randomness, Math.random);
	state.frame = 0;
};

/**
 * Passes a drawn frame to every subscriber.
 * @param scene The frame that was just drawn.
 */
const notifyListeners = (scene: Scene): void => {
	for (const listener of state.listeners) listener(scene, canvas);
};

/**
 * Reduces the current video frame to a grid of cell luminances.
 * @param size Canvas size.
 * @returns Luminance per cell.
 */
const sampleFrame = (size: Size): LuminanceGrid => {
	const { layout } = state;
	const cells = { width: layout.cols, height: layout.rows };
	const area = {
		width: layout.cols * layout.pixelSize,
		height: layout.rows * layout.cellHeight,
	};
	measure(() => drawCells(video, size, cells, area), timings.grab.push);
	const image = measure(() => readCells(cells), timings.read.push);
	return measure(() => gridLuminance(image), timings.reduce.push);
};

/**
 * Samples the current video frame, draws it as ASCII and notifies subscribers.
 */
const renderFrame = (): void => {
	const size = canvasSize();
	if (!hasArea(size) || !hasFrame()) return;
	state.frame += 1;
	const luminance = sampleFrame(size);
	if (state.layout.effectWidth < 1) drawImage(video, size);
	const scene = createScene({
		size,
		style: state.style,
		layout: state.layout,
		rain: state.rain,
		luminance,
		frame: state.frame,
		random: Math.random,
	});
	measure(() => drawAscii(ctx, scene), timings.draw.push);
	showStats([
		`canvas:  ${size.width}x${size.height}`,
		`grid:    ${state.layout.cols}x${state.layout.rows} (cell ${state.layout.pixelSize}px)`,
	]);
	notifyListeners(scene);
	countCanvasFrame(performance.now());
};

/**
 * Loads a video file, fits the canvas to it and draws its first frame.
 * @param file Video file chosen by the user.
 */
const loadFile = async (file: File): Promise<void> => {
	resizeCanvas(await loadVideoFile(file));
	refresh();
	renderFrame();
};

/**
 * Loads the bundled default video, so the page shows something before a file is chosen.
 */
const loadDefaultVideo = async (): Promise<void> => {
	const blob = await fetch(defaultVideoUrl).then((response) => response.blob());
	await loadFile(new File([blob], "megumin.mp4", { type: blob.type }));
};

/**
 * Loads the chosen file whenever the file input changes, and the default video at start.
 */
const bindFileInput = (): void => {
	const input = byId<HTMLInputElement>("inputFile");
	input.addEventListener("change", () => {
		const file = input.files?.[0];
		if (file) loadFile(file).catch(console.error);
	});
	loadDefaultVideo().catch(console.error);
};

/**
 * Subscribes to every rendered frame.
 * @param listener Called after each frame is drawn.
 * @returns A function that unsubscribes the listener.
 */
export const onFrame = (listener: FrameListener): (() => void) => {
	state.listeners.add(listener);
	return () => state.listeners.delete(listener);
};

/**
 * Merges new settings over the current ones and redraws the frame.
 * @param overrides Settings to change; the rest stay as they are.
 */
export const configure = (overrides: Partial<Settings>): void => {
	updateSettings(overrides);
	refresh();
	renderFrame();
};

/**
 * Wires up the page and starts drawing every frame the video presents.
 * @param overrides Settings to apply before the first frame.
 */
export const mount = (overrides: Partial<Settings> = {}): void => {
	updateSettings(overrides);
	bindFileInput();
	refresh();
	watchFrames((metadata) => {
		countVideoFrame(metadata.presentationTime, metadata.presentedFrames);
		renderFrame();
	});
};
