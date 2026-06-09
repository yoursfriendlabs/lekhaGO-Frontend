import config from "eslint-config-xo";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
export default defineConfig([
  config,
  {
    "extends": [
      "some-other-config-you-use",
      "prettier",
      eslintConfigPrettier
    ]
  }
]);
