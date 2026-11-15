import type { Size } from "#libs/geometry";
import { byId } from "#libs/utils";
import { MAX_CANVAS_WIDTH } from "./video.constants.ts";

export const video = byId<HTMLVideoElement>("video");

let objectUrl: string | null = null;

/**
 * Fits a video into the maximum canvas width, keeping its aspect ratio.
 * @param source Video with loaded metadata.
 * @returns Canvas size for the video.
 */
const fitToMaxWidth = ({ videoWidth, videoHeight }: HTMLVideoElement): Size => {
	const width = Math.min(videoWidth, MAX_CANVAS_WIDTH);
	return { width, height: Math.floor(width * (videoHeight / videoWidth)) };
};

/**
 * Frees the object URL of the previously loaded file.
 */
const releaseObjectUrl = (): void => {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrl = null;
};

/**
 * Waits until the video has its first frame, or fails if it can't be decoded.
 * @returns A promise that settles on the first `loadeddata` or `error` event.
 */
const whenFirstFrameReady = (): Promise<void> =>
	new Promise((resolve, reject) => {
		const controller = new AbortController();
		const { signal } = controller;
		video.addEventListener(
			"loadeddata",
			() => {
				controller.abort();
				resolve();
			},
			{ signal },
		);
		video.addEventListener(
			"error",
			() => {
				controller.abort();
				reject(video.error ?? new Error("Video failed to load"));
			},
			{ signal },
		);
	});

/**
 * Loads a video file into the player and waits for its first frame.
 * @param file Video file chosen by the user.
 * @returns Canvas size that fits the video.
 */
export const loadVideoFile = async (file: File): Promise<Size> => {
	releaseObjectUrl();
	objectUrl = URL.createObjectURL(file);
	const ready = whenFirstFrameReady();
	video.src = objectUrl;
	await ready;
	return fitToMaxWidth(video);
};

/**
 * Whether the video has a frame that can be drawn.
 * @returns `true` once the current frame's data is available.
 */
export const hasFrame = (): boolean =>
	video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

/**
 * Calls back whenever the video presents a new frame, including after seeking while paused.
 * @param onFrame Called for each presented frame with its metadata.
 */
export const watchFrames = (
	onFrame: (metadata: VideoFrameCallbackMetadata) => void,
): void => {
	const tick = (
		_now: DOMHighResTimeStamp,
		metadata: VideoFrameCallbackMetadata,
	): void => {
		onFrame(metadata);
		video.requestVideoFrameCallback(tick);
	};
	video.requestVideoFrameCallback(tick);
};
