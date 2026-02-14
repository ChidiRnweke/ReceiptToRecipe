/// <reference types="@sveltejs/kit" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/svelte" />

import type { Session } from "$lib/db/schema";
import type { UserDao, SessionDao } from "$lib/repositories/daos";

declare global {
  namespace App {
    interface Locals {
      user: UserDao | null;
      session: SessionDao | null;
    }
    interface PageData {
      user: UserDao | null;
    }
  }
}

export {};
