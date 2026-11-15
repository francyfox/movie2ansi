import "@unocss/reset/normalize.css";
import "@unocss/reset/sanitize/sanitize.css";
import "@unocss/reset/sanitize/assets.css";
import "@unocss/reset/eric-meyer.css";
import "@fontsource/instrument-serif";

import { mount } from "#modules";
import "#modules/ansi-player";
import { mountConverter } from "#modules/web-encoder";

window.addEventListener("DOMContentLoaded", () => {
	mount();
	mountConverter();
});

/** Plays a chosen `.m2a` file in the `<ansi-player>` on the page. */
window.addEventListener("DOMContentLoaded", () => {
	const input = document.getElementById("m2aFile") as HTMLInputElement | null;
	const player = document.getElementById("ansi");
	input?.addEventListener("change", () => {
		const file = input.files?.[0];
		if (file && player) player.setAttribute("src", URL.createObjectURL(file));
	});
});
