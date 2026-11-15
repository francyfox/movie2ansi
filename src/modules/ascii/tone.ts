let table: Float32Array | null = null;

/**
 * Sets the tone curve the live preview applies to cell brightness, the same one ffmpeg's `eq` applies
 * when a video is converted: contrast around mid-gray first, then gamma.
 * @param contrast 1 leaves brightness alone.
 * @param gamma 1 leaves midtones alone; above 1 brightens them.
 */
export const setTone = (contrast: number, gamma: number): void => {
	if (contrast === 1 && gamma === 1) {
		table = null;
		return;
	}
	table = Float32Array.from({ length: 256 }, (_, level) => {
		const stretched = Math.min(1, Math.max(0, (level / 255 - 0.5) * contrast + 0.5));
		return 255 * stretched ** (1 / gamma);
	});
};

/**
 * @param luminance Brightness in `[0, 255]`.
 * @returns The brightness after the tone curve.
 */
export const tone = (luminance: number): number => {
	if (!table) return luminance;
	const at = Math.min(255, Math.max(0, luminance));
	const low = Math.floor(at);
	const a = table[low] ?? 0;
	return a + ((table[Math.min(255, low + 1)] ?? a) - a) * (at - low);
};
