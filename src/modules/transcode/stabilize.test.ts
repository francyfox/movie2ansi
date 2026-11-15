import { expect, test } from "bun:test";
import { createStabilizer } from "./stabilize.ts";

test("step 1 and dead zone 0 change nothing", () => {
	const stabilize = createStabilizer({ step: 1, deadband: 0 });
	expect([...stabilize(Uint8Array.from([0, 77, 255]))]).toEqual([0, 77, 255]);
	expect([...stabilize(Uint8Array.from([1, 78, 254]))]).toEqual([1, 78, 254]);
});

test("small drift is held, a real change goes through", () => {
	const stabilize = createStabilizer({ step: 1, deadband: 4 });
	stabilize(Uint8Array.from([100, 100]));
	expect([...stabilize(Uint8Array.from([103, 96]))]).toEqual([100, 100]);
	// Drift is measured against the held value, so slow creep cannot sneak past one frame at a time.
	expect([...stabilize(Uint8Array.from([105, 90]))]).toEqual([105, 90]);
});

test("values snap to the step and stay within a byte", () => {
	const stabilize = createStabilizer({ step: 8, deadband: 0 });
	expect([...stabilize(Uint8Array.from([0, 3, 5, 12, 255]))]).toEqual([0, 0, 8, 16, 255]);
});
