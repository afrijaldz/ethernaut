import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const ENV_PREFIX = "REACT_APP_";

export default defineConfig(({ mode }) => {
  // Only these variables reach the bundle. Never define `process.env` with all values:
  // constants.js also reads the private key and the RPC URL of the operator scripts.
  const env = loadEnv(mode, import.meta.dirname, ENV_PREFIX);
  // The other variables of constants.js are undefined in the browser.
  const define = { "process.env": "{}" };
  for (const name of Object.keys(env)) {
    define[`process.env.${name}`] = JSON.stringify(env[name]);
  }

  return {
    plugins: [react()],
    envPrefix: ENV_PREFIX,
    define,
    server: { port: 3000 },
    build: {
      outDir: "build",
      target: ["chrome111", "edge111", "firefox114", "safari16.4"],
      // The level descriptions and sources are fetched, so they must be files.
      assetsInlineLimit: 0,
    },
  };
});
