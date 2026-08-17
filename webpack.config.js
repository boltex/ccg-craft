const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
    const isProduction = argv.mode === "production";

    return {
        entry: "./src/index.ts",

        output: {
            filename: "bundle.[contenthash].js",
            path: path.resolve(__dirname, "dist"),
            clean: true,
        },

        resolve: {
            extensions: [".ts", ".js"],
        },

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: "ts-loader",
                },
                {
                    test: /\.css$/,
                    use: ["style-loader", "css-loader"],
                },
            ],
        },

        plugins: [
            new HtmlWebpackPlugin({
                template: "./src/index.html",
            }),

            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: "public",
                        to: ".",
                    },
                ],
            }),
        ],

        devtool: isProduction ? "source-map" : "eval-source-map",

        devServer: {
            hot: true,
            historyApiFallback: true,
            port: 8080,
            client: {
                overlay: {
                    errors: true,
                    warnings: false,
                },
            },
        },
    };
};