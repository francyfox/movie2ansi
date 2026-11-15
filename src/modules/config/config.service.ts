import Value from "typebox/value";
import { ConfigSchema, type Config } from "./config.schema.ts";

export const DEFAULT_CONFIG_PATH = "encode.toml";

/**
 * Reads a TOML config, fills defaults and validates it against {@link ConfigSchema}.
 * @param path Path to the `.toml` file.
 * @returns The config with every optional field filled in.
 * @throws If the file is missing, is not valid TOML, or fails validation (lists every problem).
 */
export const loadConfig = async (path: string): Promise<Config> => {
	const file = Bun.file(path);
	if (!(await file.exists())) throw new Error(`Config not found: ${path}`);

	let raw: unknown;
	try {
		raw = Bun.TOML.parse(await file.text());
	} catch (error) {
		throw new Error(`${path}: invalid TOML: ${(error as Error).message}`);
	}

	const withDefaults = Value.Default(ConfigSchema, Value.Clone(raw));
	if (Value.Check(ConfigSchema, withDefaults)) return withDefaults as Config;

	const problems = Value.Errors(ConfigSchema, withDefaults)
		.map((e) => `  ${e.instancePath || "/"}: ${e.message}`)
		.join("\n");
	throw new Error(`${path}: invalid config\n${problems}`);
};
