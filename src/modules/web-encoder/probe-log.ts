import type { Size } from "#libs/geometry";

export interface VideoInfo {
	/** Size as it will be decoded: rotation already applied, like `ffprobeSize` does it. */
	size: Size;
	/** Length in seconds, `0` if ffmpeg did not say. */
	duration: number;
}

/**
 * Reads what `ffmpeg -i file` prints about a video. Without an output ffmpeg exits with an error,
 * but only after it has described the input, which is all that is needed.
 * @param log Everything ffmpeg wrote.
 * @returns Size and duration.
 * @throws If the log has no video stream.
 */
export const parseVideoInfo = (log: string): VideoInfo => {
	const stream = /Video:.*?, (\d{2,5})x(\d{2,5})[ ,[]/.exec(log);
	if (!stream) throw new Error("No video stream found (is it a video file?)");
	const width = Number(stream[1]);
	const height = Number(stream[2]);
	const rotation = Number(/rotation of (-?\d+(?:\.\d+)?) degrees/.exec(log)?.[1] ?? 0);
	const turned = Math.abs(Math.round(rotation)) % 180 === 90;
	const time = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(log);
	const duration = time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : 0;
	return { size: turned ? { width: height, height: width } : { width, height }, duration };
};
