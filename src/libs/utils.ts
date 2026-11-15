/**
 * Looks up a DOM element by id, failing loudly if the markup is missing it.
 * @param id Element id without `#`.
 * @returns The element cast to the requested type.
 */
export const byId = <T extends HTMLElement>(id: string): T => {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Element #${id} not found`);
	return element as T;
};
