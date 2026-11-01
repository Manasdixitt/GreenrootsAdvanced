import { defineConfig } from "vite";
import { resolve } from "path";
import { cpSync } from "fs";

const copyStaticScripts = () => ({
  name: "copy-static-scripts",
  closeBundle: () => {
    const files = ["supabase-client.js", "app.js", "script.js"];
    for (const file of files) {
      cpSync(resolve(__dirname, file), resolve(__dirname, "dist", file));
    }
  },
});

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
  plugins: [copyStaticScripts()],
});
