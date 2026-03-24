const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/service-worker/service-worker.ts",
  output: {
    path: path.resolve(__dirname, "public"),
    filename: "service-worker.js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "src", "service-worker", "tsconfig.json"),
            projectReferences: true,
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
};
