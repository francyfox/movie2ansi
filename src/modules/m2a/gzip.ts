const run = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> =>
	new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());

/**
 * Gzips bytes with the platform's stream API, which exists in browsers and in Bun.
 * @param bytes Any bytes.
 * @returns A complete gzip stream.
 */
export const gzip = (bytes: Uint8Array): Promise<Uint8Array> => run(bytes, new CompressionStream("gzip"));

/**
 * Gunzips bytes with the platform's stream API.
 * @param bytes A complete gzip stream.
 * @returns The decompressed bytes.
 */
export const gunzip = (bytes: Uint8Array): Promise<Uint8Array> => run(bytes, new DecompressionStream("gzip"));
