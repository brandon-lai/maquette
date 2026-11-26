import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3217",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    launchOptions: {
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--use-gl=angle",
      ],
    },
  },
  reporter: "list",
});
