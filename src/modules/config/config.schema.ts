import Type, { type Static } from "typebox";
import { DEFAULT_SETTINGS, TEXT_MODE } from "#modules/settings";

const HEX_COLOR = "^#[0-9a-fA-F]{6}$";
const D = DEFAULT_SETTINGS;

/** `[look]` table: how cells are rendered. Everything is optional and falls back to the app defaults. */
export const LookSchema = Type.Object(
	{
		backgroundColor: Type.Optional(
			Type.String({ pattern: HEX_COLOR, default: D.backgroundColor }),
		),
		backgroundGradient: Type.Optional(
			Type.Boolean({ default: D.backgroundGradient }),
		),
		backgroundSaturation: Type.Optional(
			Type.Number({
				minimum: 0,
				maximum: 100,
				default: D.backgroundSaturation,
			}),
		),
		fontColor: Type.Optional(
			Type.String({ pattern: HEX_COLOR, default: D.fontColor }),
		),
		fontColor2: Type.Optional(
			Type.String({ pattern: HEX_COLOR, default: D.fontColor2 }),
		),
		fontSizeFactor: Type.Optional(
			Type.Number({ minimum: 0, maximum: 10, default: D.fontSizeFactor }),
		),
		pixelSizeFactor: Type.Optional(
			Type.Number({ minimum: 10, maximum: 200, default: D.pixelSizeFactor }),
		),
		threshold: Type.Optional(
			Type.Number({ minimum: 0, maximum: 95, default: D.threshold }),
		),
		textInput: Type.Optional(Type.String({ default: D.textInput })),
		randomness: Type.Optional(
			Type.Number({ minimum: 0, maximum: 100, default: D.randomness }),
		),
		invert: Type.Optional(Type.Boolean({ default: D.invert })),
		animationType: Type.Optional(
			Type.Union(
				[Type.Literal(TEXT_MODE.RANDOM), Type.Literal(TEXT_MODE.USER)],
				{
					default: D.animationType,
				},
			),
		),
		effectWidth: Type.Optional(
			Type.Number({ minimum: 0, maximum: 100, default: D.effectWidth }),
		),
	},
	{ additionalProperties: false, default: {} },
);

/** Whole encoder config file. Only `inputPath` is required. */
export const ConfigSchema = Type.Object(
	{
		/** `file://…`, `http(s)://…` or a plain path. */
		inputPath: Type.String({ minLength: 1 }),
		/** Where the `.m2a` file is written; missing folders are created. */
		outputPath: Type.Optional(Type.String({ minLength: 1, default: "out/output.m2a" })),
		/** Output frame rate. */
		/** Seed for rain, glitches and random characters; the same seed gives the same output. */
		seed: Type.Optional(Type.Integer({ default: 0 })),
		fps: Type.Optional(
			Type.Number({ exclusiveMinimum: 0, maximum: 240, default: 30 }),
		),
		/** Cell width divided by height: 1 for square cells, 0.5 for a terminal (cells about twice as tall as wide). */
		cellAspect: Type.Optional(
			Type.Number({ exclusiveMinimum: 0, maximum: 4, default: 1 }),
		),
		/** Contrast applied by ffmpeg before cells are decided: 1 = unchanged, 1.5 = sharper silhouettes. */
		contrast: Type.Optional(Type.Number({ minimum: 0.1, maximum: 4, default: 1 })),
		/** Gamma applied by ffmpeg with the contrast: 1 = unchanged, above 1 brightens midtones, below 1 darkens them. */
		gamma: Type.Optional(Type.Number({ minimum: 0.1, maximum: 10, default: 1 })),
		/** Brightness is rounded to a multiple of this before cells are decided; 1 keeps every level. */
		luminanceStep: Type.Optional(Type.Integer({ minimum: 1, maximum: 64, default: 1 })),
		/** A cell keeps its previous brightness unless it changed by more than this; 0 follows every change. */
		deadband: Type.Optional(Type.Integer({ minimum: 0, maximum: 64, default: 0 })),
		look: Type.Optional(LookSchema),
	},
	{ additionalProperties: false },
);

/** Config as parsed from TOML: optional fields may be missing. */
export type RawConfig = Static<typeof ConfigSchema>;

/** Config after defaults are applied: every field is present. */
export interface Config {
	inputPath: string;
	outputPath: string;
	fps: number;
	seed: number;
	cellAspect: number;
	contrast: number;
	gamma: number;
	luminanceStep: number;
	deadband: number;
	look: Required<Static<typeof LookSchema>>;
}
