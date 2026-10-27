import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "work-out-timer";
const pagesBase =
  process.env.GITHUB_PAGES === "true" ? `/${repoName}/` : "/";
const routerBasepath =
  pagesBase === "/" ? undefined : pagesBase.replace(/\/$/, "");

export default defineConfig({
  base: pagesBase,
  server: { port: 8080 },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      router: routerBasepath ? { basepath: routerBasepath } : {},
      prerender: { enabled: true },
      spa: { enabled: false },
      sitemap: { enabled: false },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    viteReact(),
  ],
});
