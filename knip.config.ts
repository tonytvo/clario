/** @type {import('knip').KnipConfig} */
export default {
  workspaces: {
    ".": {
      entry: ["scripts/**/*.mjs"],
      project: ["scripts/**/*.mjs"],
    },
    "apps/web": {
      entry: ["src/app/**/{page,layout,route}.{tsx,ts}"],
      project: ["src/**/*.{ts,tsx,jsx}"],
    },
    "apps/desktop": {
      entry: ["src/launcher.mjs"],
      project: ["src/**/*.mjs"],
    },
    "packages/api": {
      project: ["src/**/*.ts"],
    },
    "packages/shared": {
      project: ["src/**/*.ts"],
    },
    "packages/db": {
      entry: [],
      project: [],
    },
  },
  // Scaffold files for features not yet implemented (receipt upload, Google Drive, Supabase auth)
  ignoreFiles: [
    "apps/web/src/hooks/useReceiptUpload.ts",
    "apps/web/src/lib/gdrive/drive.ts",
    "apps/web/src/lib/supabase/client.ts",
  ],
  ignoreBinaries: [
    // Supabase CLI — installed globally, used in db:migrate / db:types scripts
    "supabase",
  ],
  ignoreDependencies: [
    // Supabase client used by auth files scaffolded but not yet wired
    "@supabase/ssr",
    "@supabase/supabase-js",
  ],
};
