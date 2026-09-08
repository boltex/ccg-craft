const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

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
                    use: [
                        // Extracted into a real <link> stylesheet (instead of style-loader's JS injection) so it applies before the JS bundle loads, avoiding a flash of unstyled content.
                        MiniCssExtractPlugin.loader,
                        // url: false leaves url(...) refs as-is, resolved against the copied public/ assets at the site root.
                        { loader: "css-loader", options: { url: false } },
                    ],
                },
                {
                    // Detects when you append resourceQuery '?inline' to an import
                    resourceQuery: /inline/,
                    type: 'asset/inline',
                },
            ],
        },

        plugins: [
            new HtmlWebpackPlugin({
                template: "./src/index.html",
            }),

            new MiniCssExtractPlugin({
                filename: "styles.[contenthash].css",
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