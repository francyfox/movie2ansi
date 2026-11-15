import { AnsiPlayerElement } from "./ansi-player.element.ts";

export const ANSI_PLAYER_TAG = "ansi-player";

// Registering on import means `<ansi-player>` just works once the module is loaded.
if (!customElements.get(ANSI_PLAYER_TAG))
	customElements.define(ANSI_PLAYER_TAG, AnsiPlayerElement);

export { AnsiPlayerElement };
