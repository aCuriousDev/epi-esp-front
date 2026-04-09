const DEV_FALLBACK = "http://localhost:5054";

export function getApiUrl(): string {
    if (import.meta.env.DEV) {
        return import.meta.env.VITE_API_URL || DEV_FALLBACK;
    }
    return import.meta.env.VITE_API_URL || window.location.origin;
}
