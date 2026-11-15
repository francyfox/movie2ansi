/**
 * Re-slices a byte stream into fixed-size frames; stream chunks may split a frame anywhere.
 * @param stream Raw bytes, e.g. ffmpeg stdout.
 * @param frameSize Bytes per frame.
 * @yields One frame at a time. A trailing partial frame is dropped.
 */
export async function* chunkFrames(
	stream: ReadableStream<Uint8Array>,
	frameSize: number,
): AsyncGenerator<Uint8Array> {
	const reader = stream.getReader();
	let pending = new Uint8Array(0);
	for (;;) {
		const { done, value: chunk } = await reader.read();
		if (done) return;
		const merged = new Uint8Array(pending.length + chunk.length);
		merged.set(pending);
		merged.set(chunk, pending.length);
		let offset = 0;
		while (merged.length - offset >= frameSize) {
			yield merged.slice(offset, offset + frameSize);
			offset += frameSize;
		}
		pending = merged.subarray(offset);
	}
}
