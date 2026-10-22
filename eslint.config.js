import tseslint from "typescript-eslint";

// ---- Boundaries: dependencies point one way ----
// Flat config replaces (does not merge) a rule's options when several blocks match a file,
// so every file matches exactly ONE boundary block carrying all of its restrictions.

const DEEP_FEATURE_IMPORT = {
  regex: String.raw`(^|/)features/[^/]+/(?!index\.ts$)[^/]+`,
  message: "Import a feature only through its index.ts.",
};
const SIBLING_FEATURE_IMPORT = {
  // From inside a feature, e.g. "../tables/table-service.ts".
  regex: String.raw`^\.\./[^/.][^/]*/(?!index\.ts$).+`,
  message: "Import another feature only through its index.ts.",
};
const LIB_IMPORTS_FEATURE = {
  regex: String.raw`(^|/)features/`,
  message: "Shared lib code never imports a feature.",
};

const APP_RULES = {
  server: { group: ["@dominio/web", "react", "react-dom"], message: "Server code never imports web code." },
  web: { group: ["@dominio/server", "socket.io", "node:*"], message: "Web code never imports server code." },
};

function restrict(files, patterns, ignores = []) {
  return { files, ignores, rules: { "no-restricted-imports": ["error", { patterns }] } };
}

function appBoundaries(app) {
  const src = `apps/${app}/src`;
  const base = APP_RULES[app];
  return [
    restrict([`${src}/features/**`], [base, SIBLING_FEATURE_IMPORT]),
    restrict([`${src}/lib/**`], [base, LIB_IMPORTS_FEATURE]),
    restrict([`${src}/**`], [base, DEEP_FEATURE_IMPORT], [`${src}/features/**`, `${src}/lib/**`]),
  ];
}

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/dev-dist/**", "**/coverage/**"] },

  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      eqeqeq: "error",
    },
  },

  // Root tooling config files and scripts are not part of any package tsconfig.
  {
    files: ["*.config.js", "*.config.ts", "scripts/**"],
    ...tseslint.configs.disableTypeChecked,
  },

  restrict(
    ["packages/engine/src/**"],
    [
      {
        group: ["@dominio/*", "socket.io", "socket.io-client", "react", "react-dom", "zod", "node:*"],
        message: "The engine is pure game rules: no IO, frameworks or other packages.",
      },
    ],
  ),
  restrict(
    ["packages/protocol/src/**"],
    [
      {
        group: ["@dominio/server", "@dominio/web", "socket.io", "socket.io-client", "react", "react-dom", "node:*"],
        message: "The protocol only describes messages: it depends on the engine's types and zod only.",
      },
    ],
  ),
  ...appBoundaries("server"),
  ...appBoundaries("web"),

  // Formatting and date math live in lib/ only.
  {
    files: ["apps/*/src/**"],
    ignores: ["apps/*/src/lib/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name='toLocaleString']", message: "Format through a lib/ helper." },
        { selector: "Identifier[name='Intl']", message: "Format through a lib/ helper." },
      ],
    },
  },
);
