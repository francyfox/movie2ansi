import { CELL_TO_FONT_RATIO, createPainter } from "#modules/ascii";
import { type CellDecoder, createCellDecoder, type M2aFile, openM2a } from "#modules/m2a";
import { ANSI_PLAYER_ICONS } from "./ansi-player.icons.ts";
import { PLAYER_STYLES, PLAYER_TEMPLATE } from "./ansi-player.template.ts";

const DEFAULT_CELL_WIDTH = 8;
/** Decoded GOPs kept around, so scrubbing inside a few seconds does not decompress again. */
const GOP_CACHE_SIZE = 3;
/**
 * How long a seek waits for the next one before it runs. Dragging the slider fires dozens of seeks a second,
 * and each would unpack a multi-megabyte GOP; only the last position matters.
 */
const SEEK_DELAY_MS = 150;

const formatTime = (seconds: number): string => {
	const whole = Math.floor(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * `<ansi-player src="movie.m2a" controls autoplay loop show-fps cell-width="8">`
 *
 * Plays an `.m2a` file on a canvas with its own clock, with the interface of a media element:
 * `play()`, `pause()`, `currentTime` (read and write), `duration`, `paused`, and the events
 * `loadedmetadata`, `play`, `pause`, `seeking`, `seeked`, `timeupdate`, `ended`.
 */
export class AnsiPlayerElement extends HTMLElement {
	static observedAttributes = ["src", "cell-width"];

	readonly #canvas: HTMLCanvasElement;
	readonly #ctx: CanvasRenderingContext2D;
	readonly #button: HTMLButtonElement;
	readonly #slider: HTMLInputElement;
	readonly #label: HTMLSpanElement;
	readonly #fullscreenButton: HTMLButtonElement;
	readonly #noSignal: HTMLDivElement;
	readonly #fpsLabel: HTMLDivElement;

	#file: M2aFile | null = null;
	#screen: CellDecoder | null = null;
	#cell = { width: DEFAULT_CELL_WIDTH, height: DEFAULT_CELL_WIDTH };
	#gops = new Map<number, Uint8Array[]>();
	/** GOPs being unpacked right now, so the same one is never unpacked twice at once. */
	#unpacking = new Map<number, Promise<Uint8Array[]>>();
	#seekTimer: ReturnType<typeof setTimeout> | undefined;

	#time = 0;
	#shown = -1;
	#playing = false;
	#frameRequest = 0;
	#lastTick = 0;
	/** Bumped by every load or seek; an older async step sees it changed and stops. */
	#epoch = 0;
	/** Frames painted since `#fpsSince`; shown as fps by the `show-fps` attribute. */
	#fpsFrames = 0;
	#fpsSince = 0;
	#busy = false;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `<style>${PLAYER_STYLES}</style>${PLAYER_TEMPLATE}`;
		this.#canvas = root.querySelector("canvas") as HTMLCanvasElement;
		this.#ctx = this.#canvas.getContext("2d") as CanvasRenderingContext2D;
		this.#button = root.querySelector(".play") as HTMLButtonElement;
		this.#fullscreenButton = root.querySelector(".fullscreen") as HTMLButtonElement;
		this.#noSignal = root.querySelector(".no-signal") as HTMLDivElement;
		this.#fpsLabel = root.querySelector(".fps") as HTMLDivElement;
		this.#slider = root.querySelector("input") as HTMLInputElement;
		this.#label = root.querySelector("span") as HTMLSpanElement;

		this.#button.addEventListener("click", () => {
			if (this.paused) this.play().catch(console.error);
			else this.pause();
		});
		// The host goes fullscreen, not the canvas, so the controls stay on screen.
		this.#fullscreenButton.hidden = !this.requestFullscreen;
		this.#fullscreenButton.addEventListener("click", () => this.toggleFullscreen());
		this.#canvas.addEventListener("dblclick", () => this.toggleFullscreen());
		this.#slider.addEventListener("input", () => {
			this.currentTime = Number(this.#slider.value);
		});
	}

	connectedCallback(): void {
		document.addEventListener("fullscreenchange", this.#onFullscreenChange);
		this.#syncControls();
	}

	disconnectedCallback(): void {
		document.removeEventListener("fullscreenchange", this.#onFullscreenChange);
		this.pause();
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
		if (previous === next) return;
		if (name === "src") {
			if (next) this.load(next).catch(console.error);
			else this.#unload();
		}
		if (name === "cell-width" && this.#file) this.#setup(this.#file);
	}

	get src(): string {
		return this.getAttribute("src") ?? "";
	}

	set src(value: string) {
		this.setAttribute("src", value);
	}

	get fullscreen(): boolean {
		return document.fullscreenElement === this;
	}

	/** Enters or leaves fullscreen; rejects if the browser refuses (it needs a user gesture). */
	async toggleFullscreen(): Promise<void> {
		if (this.fullscreen) await document.exitFullscreen();
		else await this.requestFullscreen();
	}

	get paused(): boolean {
		return !this.#playing;
	}

	get duration(): number {
		return this.#file?.duration ?? 0;
	}

	get currentTime(): number {
		return this.#time;
	}

	set currentTime(seconds: number) {
		if (!this.#file) return;
		this.#time = Math.min(Math.max(seconds, 0), this.duration);
		this.#syncControls();
		// Debounced: the position updates at once, the picture only after the user stops moving.
		if (this.#seekTimer === undefined) this.dispatchEvent(new Event("seeking"));
		clearTimeout(this.#seekTimer);
		this.#seekTimer = setTimeout(() => {
			this.#seekTimer = undefined;
			this.#epoch += 1; // drops any step still waiting from an earlier position
			this.#lastTick = performance.now();
			this.#show().then(() => this.dispatchEvent(new Event("seeked")));
		}, SEEK_DELAY_MS);
	}

	/** Loads a file, shows its first frame and starts playing if `autoplay` is set. */
	async load(url: string): Promise<void> {
		const epoch = ++this.#epoch;
		this.pause();
		clearTimeout(this.#seekTimer);
		this.#seekTimer = undefined;
		let file: M2aFile;
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`${url}: ${response.status}`);
			file = openM2a(await response.arrayBuffer());
		} catch (error) {
			if (epoch === this.#epoch) this.#unload();
			throw error;
		}
		if (epoch !== this.#epoch) return;
		this.#setup(file);
		this.#time = 0;
		await this.#show();
		this.dispatchEvent(new Event("loadedmetadata"));
		if (this.hasAttribute("autoplay")) await this.play();
	}

	async play(): Promise<void> {
		if (!this.#file || this.#playing) return;
		if (this.#time >= this.duration) this.#time = 0;
		this.#playing = true;
		this.#lastTick = performance.now();
		this.#resetFps(this.#lastTick);
		this.#frameRequest = requestAnimationFrame(this.#tick);
		this.#syncControls();
		this.dispatchEvent(new Event("play"));
	}

	pause(): void {
		if (!this.#playing) return;
		this.#playing = false;
		cancelAnimationFrame(this.#frameRequest);
		this.#fpsLabel.textContent = "";
		this.#syncControls();
		this.dispatchEvent(new Event("pause"));
	}

	/** Sizes the canvas and the screen for a new file. */
	#setup(file: M2aFile): void {
		const { cols, rows, cellAspect, background } = file.header;
		const width = Number(this.getAttribute("cell-width")) || DEFAULT_CELL_WIDTH;
		this.#file = file;
		this.#cell = { width, height: width / cellAspect };
		this.#gops.clear();
		this.#unpacking.clear();
		this.#screen = createCellDecoder(cols * rows);
		this.#shown = -1;
		this.#canvas.width = cols * width;
		this.#canvas.height = Math.round(rows * this.#cell.height);
		this.#ctx.fillStyle = background;
		this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
		this.#slider.max = String(file.duration);
		this.#slider.step = String(1 / file.header.fps);
	}

	/** Advances the clock by real elapsed time, then shows the frame it points at. */
	#tick = (now: number): void => {
		if (!this.#playing) return;
		// A seek is waiting for its delay: hold the clock, or the picture would jump past the target.
		if (this.#seekTimer !== undefined) {
			this.#lastTick = now;
			this.#frameRequest = requestAnimationFrame(this.#tick);
			return;
		}
		// The rAF timestamp is the frame's start and can be earlier than the `performance.now()` taken in `play()`.
		this.#time += Math.max(0, now - this.#lastTick) / 1000;
		this.#lastTick = now;
		this.#updateFps(now);
		if (this.#time >= this.duration) {
			if (this.hasAttribute("loop")) this.#time %= this.duration;
			else {
				this.#time = this.duration;
				this.#show();
				this.pause();
				this.dispatchEvent(new Event("ended"));
				return;
			}
		}
		// A frame that still waits for its GOP to unpack is skipped, not queued: the clock keeps going.
		if (!this.#busy) this.#show();
		this.#frameRequest = requestAnimationFrame(this.#tick);
	};

	#resetFps(now: number): void {
		this.#fpsFrames = 0;
		this.#fpsSince = now;
	}

	/** Once per half second: frames actually painted per second, which drops below the file's rate when the machine is slow. */
	#updateFps(now: number): void {
		const elapsed = now - this.#fpsSince;
		if (elapsed < 500) return;
		if (this.hasAttribute("show-fps")) this.#fpsLabel.textContent = `${((this.#fpsFrames * 1000) / elapsed).toFixed(1)} fps`;
		this.#resetFps(now);
	}

	/** Decompresses a GOP once and keeps the latest few. */
	async #gop(index: number): Promise<Uint8Array[]> {
		const cached = this.#gops.get(index);
		if (cached) return cached;
		const running = this.#unpacking.get(index);
		if (running) return running;
		const file = this.#file as M2aFile;
		const unpack = file
			.readGop(index)
			.then((frames) => {
				// A new file may have been loaded meanwhile; its GOP numbers mean something else.
				if (this.#file === file) {
					this.#gops.set(index, frames);
					if (this.#gops.size > GOP_CACHE_SIZE) {
						const oldest = this.#gops.keys().next().value;
						if (oldest !== undefined) this.#gops.delete(oldest);
					}
				}
				return frames;
			})
			.finally(() => this.#unpacking.delete(index));
		this.#unpacking.set(index, unpack);
		return unpack;
	}

	/**
	 * Brings the screen to the frame the clock points at.
	 * Forward inside the same GOP only the missing deltas run; anything else starts from the GOP's key frame.
	 */
	async #show(): Promise<void> {
		const file = this.#file;
		const screen = this.#screen;
		if (!file || !screen) return;
		const epoch = this.#epoch;
		const target = Math.max(0, Math.min(Math.floor(this.#time * file.header.fps), file.frames - 1));
		this.#busy = true;
		try {
			if (target !== this.#shown) {
				const gop = Math.floor(target / file.header.gop);
				const frames = await this.#gop(gop);
				if (epoch !== this.#epoch || screen !== this.#screen) return;
				const first = gop * file.header.gop;
				const sameGop = this.#shown >= first && this.#shown < target;
				const changed = new Set<number>();
				for (let n = sameGop ? this.#shown + 1 : first; n <= target; n += 1) {
					screen.apply(frames[n - first] as Uint8Array, n === first, changed);
				}
				this.#shown = target;
				this.#draw(file, screen, changed);
				this.#fpsFrames += 1;
				// Warm the next GOP so the boundary does not stall.
				if (gop + 1 < file.index.length) void this.#gop(gop + 1).catch(() => {});
			}
		} finally {
			this.#busy = false;
		}
		this.#syncControls();
		this.dispatchEvent(new Event("timeupdate"));
	}

	/**
	 * Paints only the cells that changed.
	 * Each cell must depend on its own state alone, or a partial redraw would differ from a full one:
	 * a cell covers exactly its own rounded rectangle (neighbours tile without overlap or gaps), and its
	 * character is clipped to that rectangle, so a tall glyph cannot leave marks on cells that are not redrawn.
	 */
	#draw(file: M2aFile, screen: CellDecoder, changed: ReadonlySet<number>): void {
		const { cols } = file.header;
		const { width, height } = this.#cell;
		const ctx = this.#ctx;
		const painter = createPainter(ctx);
		const fontSize = width / CELL_TO_FONT_RATIO;
		for (const index of changed) {
			const col = index % cols;
			const row = Math.floor(index / cols);
			const left = Math.round(col * width);
			const top = Math.round(row * height);
			const cellWidth = Math.round((col + 1) * width) - left;
			const cellHeight = Math.round((row + 1) * height) - top;
			painter.fill(file.bg[screen.bg(index)] as string);
			ctx.fillRect(left, top, cellWidth, cellHeight);
			const char = file.glyphs[screen.glyph(index)] as string;
			if (char === " ") continue;
			ctx.save();
			ctx.beginPath();
			ctx.rect(left, top, cellWidth, cellHeight);
			ctx.clip();
			painter.font(fontSize);
			painter.fill(file.fg[screen.fg(index)] as string);
			ctx.fillText(char, left, top + cellHeight);
			ctx.restore();
		}
	}

	#onFullscreenChange = (): void => {
		this.#syncControls();
		this.dispatchEvent(new Event("fullscreenchange"));
	};

	/** Drops the current file and shows "NO SIGNAL". */
	#unload(): void {
		this.#epoch += 1;
		this.pause();
		clearTimeout(this.#seekTimer);
		this.#seekTimer = undefined;
		this.#file = null;
		this.#screen = null;
		this.#gops.clear();
		this.#unpacking.clear();
		this.#time = 0;
		this.#shown = -1;
		this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
		this.#syncControls();
	}

	/**
	 * Puts an icon into a button, only if it is not there yet. This runs on every frame, and replacing a button's
	 * content that often swallows mouse clicks: the press and the release land on different nodes.
	 */
	#setIcon(button: HTMLButtonElement, icon: keyof typeof ANSI_PLAYER_ICONS): void {
		if (button.dataset.icon === icon) return;
		button.dataset.icon = icon;
		button.innerHTML = ANSI_PLAYER_ICONS[icon];
	}

	#syncControls(): void {
		this.#noSignal.hidden = this.#file !== null;
		this.#setIcon(this.#fullscreenButton, this.fullscreen ? "minimize" : "maximize");
		this.#setIcon(this.#button, this.#playing ? "pause" : "play");
		this.#slider.value = String(this.#time);
		this.#label.textContent = `${formatTime(this.#time)} / ${formatTime(this.duration)}`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"ansi-player": AnsiPlayerElement;
	}
}
