import { expect, test } from "bun:test";
import { parseVideoInfo } from "./probe-log.ts";

// Real output of ffmpeg.wasm for scenes/04_dance.mp4 (shortened).
const LOG = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input':
  Duration: 00:00:07.07, start: 0.000000, bitrate: 10628 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 800x1080 [SAR 1:1 DAR 20:27], 10301 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 320 kb/s (default)`;

test("size and duration come from the stream lines", () => {
	expect(parseVideoInfo(LOG)).toEqual({ size: { width: 800, height: 1080 }, duration: 7.07 });
});

test("a quarter turn swaps the sides, like ffprobeSize does", () => {
	const turned = `${LOG}\n      displaymatrix: rotation of -90.00 degrees`;
	expect(parseVideoInfo(turned).size).toEqual({ width: 1080, height: 800 });
});

test("a file without a video stream is an error", () => {
	expect(() => parseVideoInfo("Stream #0:0: Audio: mp3, 44100 Hz")).toThrow("No video stream");
});
