import { parseArgs } from "node:util";
import { DEFAULT_CONFIG_PATH, loadConfig } from "#modules/config";
import { EncoderService } from "#modules/encoder";

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		config: { type: "string", short: "c", default: DEFAULT_CONFIG_PATH },
	},
	strict: true,
	allowPositionals: true,
});

const config = await loadConfig(values.config);

await EncoderService().encode(config);
