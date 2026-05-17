/** @type {import('knip').KnipConfig} */
export default {
  workspaces: {
    "apps/web": {
      entry: ["src/app/**/{page,layout,route}.tsx", "src/app/**/*.ts"],
      project: ["src/**/*.{ts,tsx}"],
    },
    "packages/shared": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },
    "packages/db": {
      entry: [],
      project: [],
    },
  },
  ignore: [
    "**/*.config.{ts,js,mjs}",
    "**/scripts/**",
    "**/.next/**",
  ],
  ignoreDependencies: [
    // Next.js peer deps — used implicitly
    "autoprefixer",
    "postcss",
  ],
};
