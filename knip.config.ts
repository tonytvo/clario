/** @type {import('knip').KnipConfig} */
export default {
  workspaces: {
    ".": {
      // apps/desktop has no package.json, so it is analysed from the root
      entry: ["apps/desktop/src/launcher.mjs"],
      project: ["apps/desktop/src/**/*.mjs"],
    },
    "apps/web": {
      entry: ["src/app/**/{page,layout,route}.{tsx,ts}"],
      project: ["src/**/*.{ts,tsx,jsx}"],
    },
    "packages/api": {
      project: ["src/**/*.ts"],
    },
    "packages/shared": {
      project: ["src/**/*.ts"],
    },
  },
  // Scaffold files for features not yet implemented (receipt upload, Google Drive)
  ignoreFiles: [
    "apps/web/src/hooks/useReceiptUpload.ts",
    "apps/web/src/lib/gdrive/drive.ts",
  ],
};
