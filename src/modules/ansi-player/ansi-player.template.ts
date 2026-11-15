import { ANSI_PLAYER_ICONS } from "./ansi-player.icons.ts";

export const PLAYER_STYLES = `
	:host { display: block; position: relative; background: #000; border-radius: 3px; overflow: hidden; }
	canvas { display: block; width: 100%; height: 100%; min-height: 0; object-fit: contain; }
	.controls { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 10px; align-items: center;
		padding: 6px 10px; background: linear-gradient(transparent, rgba(0, 0, 0, 0.7)); color: #fff;
		font: 14px/1 ui-monospace, monospace; opacity: 0; transition: opacity 0.15s; }
	:host([controls]:hover) .controls, :host([controls]:focus-within) .controls { opacity: 1; }
	:host(:not([controls])) .controls { display: none; }
	button { all: unset; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 4px; }
	button:hover, button:focus-visible { background: rgba(255, 255, 255, 0.2); }
	button svg { width: 20px; height: 20px; }
	/* The page's own height for the host (e.g. 500px) would otherwise keep the fullscreen element small. */
	:host(:fullscreen) { width: 100vw !important; height: 100vh !important; border-radius: 0; }
	:host(:fullscreen) .controls { opacity: 1; }
	[hidden] { display: none !important; }
	.no-signal { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;
		color: #ddd; font: bold clamp(16px, 4vw, 40px)/1 ui-monospace, monospace; letter-spacing: 0.3em; }
	.fps { position: absolute; top: 6px; left: 6px; padding: 2px 6px; border-radius: 3px; pointer-events: none;
		background: rgba(0, 0, 0, 0.6); color: #7CFC9A; font: 12px/1.4 ui-monospace, monospace; }
	:host(:not([show-fps])) .fps { display: none; }
	input { flex: 1; accent-color: #c7205b; }
`;

export const PLAYER_TEMPLATE = `
	<canvas></canvas>
	<div class="no-signal">NO SIGNAL</div>
	<div class="fps" aria-hidden="true"></div>
	<div class="controls">
		<button type="button" class="play" aria-label="Play or pause">${ANSI_PLAYER_ICONS.play}</button>
		<input type="range" min="0" max="0" step="any" value="0" aria-label="Seek" />
		<span>0:00 / 0:00</span>
		<button type="button" class="fullscreen" aria-label="Fullscreen">${ANSI_PLAYER_ICONS.maximize}</button>
	</div>
`;
