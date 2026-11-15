/**
 * Recursively folds over the integers `[index, count)`.
 * @param count Exclusive upper bound.
 * @param step Combines the accumulator with the current index.
 * @param acc Initial accumulator.
 * @param index Current index, `0` by default.
 * @returns The final accumulator.
 */
export const foldRange = <A>(
	count: number,
	step: (acc: A, index: number) => A,
	acc: A,
	index = 0,
): A =>
	index >= count ? acc : foldRange(count, step, step(acc, index), ++index);

/**
 * Folds over every `(outer, inner)` pair of a two-dimensional range, row by row, in a single loop.
 * @param outerCount Size of the outer dimension.
 * @param innerCount Size of the inner dimension.
 * @param step Combines the accumulator with the current pair.
 * @param acc Initial accumulator.
 * @returns The final accumulator.
 */
export const foldGrid = <A>(
	outerCount: number,
	innerCount: number,
	step: (acc: A, outer: number, inner: number) => A,
	acc: A,
): A => {
	let result = acc;
	for (let i = 0; i < outerCount * innerCount; i += 1) {
		result = step(result, Math.floor(i / innerCount), i % innerCount);
	}
	return result;
};

/**
 * Builds an array by projecting each index of `[0, count)`.
 * @param count Number of items.
 * @param project Produces the item for an index.
 * @returns The projected items.
 */
export const mapRange = <T>(
	count: number,
	project: (index: number) => T,
): T[] =>
	foldRange(
		count,
		(items, index) => {
			items.push(project(index));
			return items;
		},
		[] as T[],
	);
