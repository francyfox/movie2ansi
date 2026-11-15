import { ConfigSchema } from "#modules/config";

const OUTPUT = "encode.schema.json";

await Bun.write(
	OUTPUT,
	`${JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", ...ConfigSchema }, null, 2)}\n`,
);
console.log(`Wrote ${OUTPUT}`);
