import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/; Vercel and everything
  // else serve from the root. The workflow sets GITHUB_PAGES=true.
  base: process.env.GITHUB_PAGES ? "/outbreak-zombie-shooter/" : "/",

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
