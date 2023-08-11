import { defineConfig } from 'father';

export default defineConfig({
  cjs: {
    output: 'dist',
    transformer: "babel"
  },
  extraBabelPresets: ["minify"]
});
