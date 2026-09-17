/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Apps Script Web App URL. Empty disables the leaderboard entirely. */
  readonly VITE_LEADERBOARD_URL?: string;
  /** Google OAuth client id. Empty disables sign-in entirely. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
