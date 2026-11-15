import { $ } from "bun";
import type { Size } from "#libs/geometry";
import { videoFilter } from "#libs/video-filter";

interface ffmpegOptions {
	inputPath: string;
	fps: number;
	cols: number;
	rows: number;
	contrast: number;
	gamma: number;
}

const frameArgs = ({ inputPath, ...filter }: ffmpegOptions): string[] => [
	"ffmpeg",
	"-hide_banner",
	"-loglevel",
	"error",
	"-nostdin",
	"-i",
	inputPath,
	"-an",
	"-vf",
	videoFilter(filter),
	"-f",
	"rawvideo",
	"pipe:1",
];

const checkFFMPEG = async (): Promise<void> => {
	const { exitCode } = await $`ffmpeg -version`.quiet().nothrow();
	if (exitCode !== 0) throw Error("No ffmpeg. Please install");
};

export async function ffmpegScale(options: ffmpegOptions) {
	await checkFFMPEG();

	return Bun.spawn(frameArgs(options), {
		stdout: "pipe",
		stderr: "pipe",
	});
}

interface ffprobeOutput {
	streams: {
		width: number;
		height: number;
		side_data_list?: { rotation?: number }[];
	}[];
}

export async function ffprobeSize(inputPath: string): Promise<Size> {
	await checkFFMPEG();

	const output: ffprobeOutput =
		await $`ffprobe -v error -select_streams v:0 -show_entries stream=width,height:stream_side_data=rotation -of json ${inputPath}`
			.quiet()
			.json();

	const stream = output.streams[0];
	if (!stream) throw Error(`No video stream in ${inputPath}`);

	const rotation =
		stream.side_data_list?.find((data) => data.rotation !== undefined)
			?.rotation ?? 0;
	const turned = Math.abs(rotation) % 180 === 90;

	return turned
		? { width: stream.height, height: stream.width }
		: { width: stream.width, height: stream.height };
}
