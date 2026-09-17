export const STORAGE_KEYS = {
    AI_API_KEY: 'aiApiKey',
    AI_MODEL: 'aiModel',
    ROUTING_TARGET: 'targetRouting',
    CUSTOM_API_URL: 'customApiUrl'
};

const LEGACY_KEYS = {
    AI_API_KEY: 'geminiApiKey',
    AI_MODEL: 'geminiModel'
};

/**
 * One-time migration for legacy Gemini-specific storage keys into the new model-blind keys.
 * @returns {Promise<void>}
 */
export async function migrateLegacyKeys() {
    const legacy = await new Promise((resolve) => {
        chrome.storage.sync.get([
            LEGACY_KEYS.AI_API_KEY,
            LEGACY_KEYS.AI_MODEL
        ], (items) => resolve(items || {}));
    });

    const patch = {};

    if (legacy[LEGACY_KEYS.AI_API_KEY]) {
        patch[STORAGE_KEYS.AI_API_KEY] = legacy[LEGACY_KEYS.AI_API_KEY];
    }
    if (legacy[LEGACY_KEYS.AI_MODEL]) {
        patch[STORAGE_KEYS.AI_MODEL] = legacy[LEGACY_KEYS.AI_MODEL];
    }

    if (Object.keys(patch).length > 0) {
        await setConfig(patch);
        await new Promise((resolve) => {
            chrome.storage.sync.remove([
                LEGACY_KEYS.AI_API_KEY,
                LEGACY_KEYS.AI_MODEL
            ], () => resolve());
        });
        console.log('[ScheduleAI] Migrated legacy Gemini keys to universal keys.');
    }
}

/**
 * Resolve global configuration properties out of local chrome storage sync buckets.
 * @returns {Promise<object>}
 */
export async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([
            STORAGE_KEYS.AI_API_KEY,
            STORAGE_KEYS.AI_MODEL,
            STORAGE_KEYS.ROUTING_TARGET,
            STORAGE_KEYS.CUSTOM_API_URL
        ], (items) => {
            resolve(items || {});
        });
    });
}

/**
 * Bulk updates local extension parameter state configurations.
 * @param {object} newConfig 
 * @returns {Promise<boolean>}
 */
export async function setConfig(newConfig) {
    return new Promise((resolve) => {
        chrome.storage.sync.set(newConfig, () => {
            resolve(true);
        });
    });
}

/**
 * Google Identity Engine Core - Interacts directly with native chrome account flags.
 * @param {boolean} interactiveMode
 * @returns {Promise<string>}
 */
export async function getGoogleAuthToken(interactiveMode = false) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: interactiveMode }, function(token) {
            if (chrome.runtime.lastError) {
                console.error("[ScheduleAI] Google Authentication Failed: ", chrome.runtime.lastError.message);
                reject(chrome.runtime.lastError);
            } else {
                resolve(token);
            }
        });
    });
}

/**
 * Revoke and remove the currently cached Google OAuth token. Used by the
 * options UI to recover from stale/revoked-token states and account switches.
 * @param {string} [token] Optional explicit token to remove from the cache.
 * @returns {Promise<boolean>}
 */
export async function revokeGoogleAuthToken(token) {
    return new Promise((resolve) => {
        const finish = () => {
            // Best-effort remote revoke; ignore network failures.
            const revokeUrl = token
                ? `https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`
                : null;
            if (revokeUrl) {
                fetch(revokeUrl).catch(() => {});
            }
            resolve(true);
        };

        if (token) {
            chrome.identity.removeCachedAuthToken({ token }, finish);
        } else {
            // No explicit token — try to fetch, remove, then revoke.
            chrome.identity.getAuthToken({ interactive: false }, (tok) => {
                if (chrome.runtime.lastError || !tok) {
                    finish();
                    return;
                }
                chrome.identity.removeCachedAuthToken({ token: tok }, () => {
                    token = tok;
                    finish();
                });
            });
        }
    });
}

/**
 * Non-interactive probe of the current Google auth state. Never prompts the
 * user and never throws — returns a plain status object so the UI can render
 * an accurate connection indicator on load.
 * @returns {Promise<{ connected: boolean, message: string }>}
 */
export async function checkGoogleAuthStatus() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (chrome.runtime.lastError) {
                resolve({ connected: false, message: chrome.runtime.lastError.message });
                return;
            }
            if (!token) {
                resolve({ connected: false, message: 'Not linked' });
                return;
            }
            resolve({ connected: true, message: 'Connected' });
        });
    });
}