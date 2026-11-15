import type { Scene } from "#modules/ascii";

/**
 * Receives each frame right after it has been drawn on the canvas.
 */
export type FrameListener = (scene: Scene, canvas: HTMLCanvasElement) => void;
