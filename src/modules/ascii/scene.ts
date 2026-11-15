import type { Scene } from "./ascii.types.ts";
import { oscillatingThreshold } from "./style.ts";

/**
 * Completes a scene with the threshold for its frame.
 * @param base Everything about the frame except the drifting threshold.
 * @returns The scene, ready to draw.
 */
export const createScene = (base: Omit<Scene, "threshold">): Scene => ({
	...base,
	threshold: oscillatingThreshold(base.style, base.frame),
});
