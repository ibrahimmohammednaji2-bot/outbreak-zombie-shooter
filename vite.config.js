import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/; Vercel and everything
  // else serve from the root. The workflow sets GITHUB_PAGES=true.
  // Pages serves from /<repo>/, a game portal serves from wherever it likes
  // (so paths must be relative), everything else from the root.
  base: process.env.PORTAL
    ? "./"
    : process.env.GITHUB_PAGES
      ? "/outbreak-zombie-shooter/"
      : "/",

  /*
   * iPads live a long time and do not always get iOS updates. Left to itself
   * the build ships whatever syntax the source used — `??=` needs iOS 14, `?.`
   * needs 13.1 — and a tablet a version behind cannot parse the bundle at all,
   * so the page comes up blank with nothing to go on. Compiling down to ES2019
   * costs a few bytes and covers everything back to iOS 12.
   */
  build: { target: ["es2019", "safari12", "chrome80", "firefox78", "edge88"] },

  // The preview server rejects hostnames it does not recognise, which blocks
  // tunnels that hand out a random subdomain. Allow them through.
  // The API is proxied under the same origin, so one tunnel serves both the
  // game and the server — and the browser never needs to know the port.
  preview: {
    allowedHosts: true,
    proxy: { "/api": "http://localhost:8787" },
  },
  server: {
    allowedHosts: true,
    proxy: { "/api": "http://localhost:8787" },
  },
});
