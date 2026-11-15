import { canvas } from "#modules/canvas";

/**
 * Builds an export file name stamped with the current local date and time.
 * @param extension File extension without the dot.
 * @returns The file name.
 */
const timestampedName = (extension: string): string => {
	const now = new Date();
	return `ASCII_${now.toLocaleDateString()}_${now.toLocaleTimeString()}.${extension}`;
};

/**
 * Triggers a browser download.
 * @param href URL or data URL of the content.
 * @param filename Suggested file name.
 */
const downloadUrl = (href: string, filename: string): void => {
	Object.assign(document.createElement("a"), {
		href,
		download: filename,
	}).click();
};

/**
 * Downloads the current canvas as a PNG.
 */
export const saveImage = (): void =>
	downloadUrl(canvas.toDataURL(), timestampedName("png"));
