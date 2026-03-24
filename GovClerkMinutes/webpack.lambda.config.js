const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/lambda/index.ts",
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "index.js",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "src", "lambda", "tsconfig.json"),
            projectReferences: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  target: "node",
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  externals: {
    // Exclude AWS SDK since it's available in the Lambda runtime
    "aws-sdk": "commonjs aws-sdk",
  },
};
