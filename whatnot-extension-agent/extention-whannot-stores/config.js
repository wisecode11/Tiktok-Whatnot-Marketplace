/**
 * Seller Hub production endpoints.
 * For local dev, copy config.local.example.js → config.local.js and change background.js import.
 */
export const SELLER_HUB_ORIGIN = "https://sellerhub.wisecodestudio.com";
export const MARKETPLACE_API_BASE = "https://sellerhub-backend.wisecodestudio.com";
export const BACKEND_SOCKET_URL = "wss://sellerhub-backend.wisecodestudio.com/ws/whatnot-extension";
/** Must match backend WHATNOT_EXTENSION_API_KEY when that env var is set (leave empty if backend has no key). */
export const WHATNOT_EXTENSION_API_KEY = "";
