import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "about.html"),
        community: resolve(__dirname, "community.html"),
        contact: resolve(__dirname, "contact.html"),
        register: resolve(__dirname, "register.html"),
        track: resolve(__dirname, "track.html"),
      },
    },
  },
});
