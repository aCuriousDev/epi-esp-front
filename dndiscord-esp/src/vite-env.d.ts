/// <reference types="vite/client" />

declare module "jquery-ui-dist/jquery-ui.min.js";

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
