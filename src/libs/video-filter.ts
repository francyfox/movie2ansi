interface VideoFilterOptions {
	fps: number;
	cols: number;
	rows: number;
	/** 1 leaves brightness alone; above 1 pushes darks darker and lights lighter around mid-gray. */
	contrast: number;
	/** 1 leaves midtones alone; above 1 brightens them, below 1 darkens them. */
	gamma: number;
}

/**
 * ffmpeg `-vf` chain that turns a video into the gray cell grid.
 * The Bun encoder and the browser (ffmpeg.wasm) use this same string, so both give the same picture.
 */
export const videoFilter = ({ fps, cols, rows, contrast, gamma }: VideoFilterOptions): string =>
	[
		`fps=${fps}`,
		`scale=${cols}:${rows}:flags=area`,
		...(contrast === 1 && gamma === 1 ? [] : [`eq=contrast=${contrast}:gamma=${gamma}`]),
		"format=gray",
	].join(",");
