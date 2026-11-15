declare module "*.css";
declare module "*.mp4" {
	const url: string;
	export default url;
}
declare module "@ffmpeg/core" {
	/** Imported with `with { type: "file" }`, so it is the URL of the copied file. */
	const url: string;
	export default url;
}
declare module "@ffmpeg/core/wasm" {
	const url: string;
	export default url;
}
