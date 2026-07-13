import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		environmentOptions: {
			happyDOM: {
				// bonobo_ui_connect reads the host origin and per-frame nonce from the iframe URL.
				url: "https://plugin.test/?parentOrigin=https://host.test&pageId=main&bridgeNonce=nonce_1",
			},
		},
		restoreMocks: true,
		unstubGlobals: true,
	},
});
