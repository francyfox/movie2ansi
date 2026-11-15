import { byId } from "#libs/utils";
import { setTone } from "#modules/ascii";
import { getSettings } from "#modules/settings";
import { encodeVideo } from "./web-encoder.service.ts";
import defaultVideoUrl from "../../public/megumin.mp4";

const number = (id: string): number => Number(byId<HTMLInputElement>(id).value);

/**
 * The video to convert: the one chosen in the file input, or the bundled default before any is chosen.
 * @returns The video as a blob.
 */
const sourceVideo = async (): Promise<Blob> => {
	const chosen = byId<HTMLInputElement>("inputFile").files?.[0];
	return chosen ?? (await fetch(defaultVideoUrl).then((response) => response.blob()));
};

/**
 * Wires the "Convert" form: encodes in the browser, shows the result in `<ansi-player>` and offers a download.
 */
export const mountConverter = (): void => {
	const button = byId<HTMLButtonElement>("convert");
	const cancel = byId<HTMLButtonElement>("convertCancel");
	const progress = byId<HTMLProgressElement>("convertProgress");
	const status = byId("convertStatus");
	const download = byId<HTMLAnchorElement>("convertDownload");
	const player = byId("ansi");
	let abort: AbortController | null = null;
	let resultUrl = "";

	const setBusy = (busy: boolean): void => {
		button.disabled = busy;
		cancel.hidden = !busy;
		progress.hidden = !busy;
	};

	// The live preview follows the same contrast and gamma the conversion will use.
	const syncTone = (): void => setTone(number("convertContrast"), number("convertGamma"));
	for (const id of ["convertContrast", "convertGamma"]) byId(id).addEventListener("input", syncTone);
	syncTone();

	cancel.addEventListener("click", () => abort?.abort());
	button.addEventListener("click", async () => {
		abort = new AbortController();
		setBusy(true);
		download.hidden = true;
		const started = performance.now();
		try {
			const result = await encodeVideo(
				await sourceVideo(),
				{
					fps: number("convertFps"),
					seed: 0,
					cellAspect: number("convertAspect"),
					contrast: number("convertContrast"),
					gamma: number("convertGamma"),
					luminanceStep: number("convertStep"),
					deadband: number("convertDeadband"),
					look: { ...getSettings(), pixelSizeFactor: number("convertDensity") },
				},
				{
					signal: abort.signal,
					onProgress: (stage, done, total) => {
						progress.max = total;
						progress.value = done;
						status.textContent =
							stage === "decode" ? `decoding ${Math.round((done / total) * 100)}%` : `${Math.floor(done)} / ${total} frames`;
					},
				},
			);
			if (resultUrl) URL.revokeObjectURL(resultUrl);
			resultUrl = URL.createObjectURL(result.blob);
			player.setAttribute("src", resultUrl);
			download.href = resultUrl;
			download.hidden = false;
			const seconds = ((performance.now() - started) / 1000).toFixed(1);
			status.textContent = `${result.cols}×${result.rows}, ${result.frames} frames, ${(result.blob.size / 1e6).toFixed(2)} MB, ${seconds} s`;
		} catch (error) {
			status.textContent = abort.signal.aborted ? "Cancelled" : `Failed: ${(error as Error).message}`;
			if (!abort.signal.aborted) console.error(error);
		} finally {
			setBusy(false);
		}
	});
};
