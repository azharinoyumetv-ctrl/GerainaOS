// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // CRA's production build minifies index.html via html-minifier-terser,
      // which also runs Terser over the content of any inline <script> tag
      // (minifyJS: true). The inline PostHog init snippet in public/index.html
      // makes that step throw "Parse Error" inside html-minifier-terser's own
      // parser, failing the whole `craco build` (and therefore the whole
      // deploy pipeline -- every deploy since this snippet was added has
      // failed at this step, silently leaving production on a stale build).
      // The snippet itself is valid, executable JS; only html-minifier's
      // inline-script minification chokes on it. Disabling minifyJS for the
      // HTML pass (HTML/CSS are still minified normally) sidesteps the bug
      // without touching analytics behavior.
      const htmlWebpackPlugin = webpackConfig.plugins.find(
        (p) => p.constructor && p.constructor.name === "HtmlWebpackPlugin"
      );
      if (htmlWebpackPlugin) {
        const opts = htmlWebpackPlugin.userOptions || htmlWebpackPlugin.options;
        if (opts && opts.minify && typeof opts.minify === "object") {
          opts.minify.minifyJS = false;
        }
      }

      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
