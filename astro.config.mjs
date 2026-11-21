import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://vahan-sahakyan.github.io",
  build: {
    // small stylesheets go inline, saving a render-blocking request on mobile
    inlineStylesheets: "auto",
  },
});
