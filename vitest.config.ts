import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		environmentOptions: {
			happyDOM: {
				// Plugin pages use their immutable asset URL; bridge state arrives only by postMessage.
				url: "https://plugin.test/dist/frontend/index.html",
			},
		},
		restoreMocks: true,
		unstubGlobals: true,
	},
});
