import { expect, test } from "bun:test";
import { setTone, tone } from "./tone.ts";

test("tone follows contrast and gamma, and is off at 1 and 1", () => {
	setTone(1, 1);
	expect(tone(100)).toBe(100);
	setTone(2, 1);
	expect(tone(128)).toBeCloseTo(128.5, 0);
	expect(tone(64)).toBeLessThan(64);
	expect(tone(200)).toBe(255);
	setTone(1, 2);
	expect(tone(64)).toBeCloseTo(255 * (64 / 255) ** 0.5, 0);
	setTone(1, 1);
});
