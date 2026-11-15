import { DEFAULT_SETTINGS } from "./settings.constants.ts";
import type { Settings } from "./settings.types.ts";

let current: Readonly<Settings> = DEFAULT_SETTINGS;

/**
 * Current settings.
 * @returns An immutable snapshot; it is replaced, never mutated, on update.
 */
export const getSettings = (): Readonly<Settings> => current;

/**
 * Merges new values over the current settings.
 * @param overrides Settings to change; the rest stay as they are.
 * @returns The updated settings.
 */
export const updateSettings = (
	overrides: Partial<Settings>,
): Readonly<Settings> => {
	current = { ...current, ...overrides };
	return current;
};
