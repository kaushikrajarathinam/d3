export default {
  base: "./", // 👈 change this
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: "baseline-widely-available",
    outDir: "dist",
    sourcemap: true,
  },
};
