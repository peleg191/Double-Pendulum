import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = import.meta.dirname;
const outputDirectory = resolve(projectRoot, "pages-dist");

export default defineConfig({
  root: resolve(projectRoot, "pages-src"),
  base: "./",
  publicDir: false,
  plugins: [
    react(),
    {
      name: "copy-orbit-data",
      closeBundle() {
        mkdirSync(outputDirectory, { recursive: true });
        cpSync(resolve(projectRoot, "public", "data"), resolve(outputDirectory, "data"), { recursive: true });
        cpSync(resolve(projectRoot, "public", "mat"), resolve(outputDirectory, "mat"), { recursive: true });
        writeFileSync(resolve(outputDirectory, ".nojekyll"), "");
      },
    },
  ],
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
  },
});
