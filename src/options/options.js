import {
    getConfig,
    setConfig,
    migrateLegacyKeys,
    getGoogleAuthToken,
    revokeGoogleAuthToken,
    checkGoogleAuthStatus,
    STORAGE_KEYS
} from '../config/config.js';
import { testAiConnection, normalizeEndpoint } from '../ai/timeNow.js';

const DEFAULT_MODEL = 'google/gemini-flash-1.5';
const AUTOSAVE_DEBOUNCE_MS = 400;

document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        aiKey: document.getElementById('aiKey'),
        aiModel: document.getElementById('aiModel'),
        routingTarget: document.getElementById('routingTarget'),
        customApiUrl: document.getElementById('customApiUrl'),
        save: document.getElementById('save'),
        status: document.getElementById('status'),
    };

    try {
        await migrateLegacyKeys();
    } catch (err) {
        console.warn('[ScheduleAI] Legacy migration skipped:', err);
    }

    

    const config = await getConfig();
    els.aiKey.value = config[STORAGE_KEYS.AI_API_KEY] || '';
    els.aiModel.value = config[STORAGE_KEYS.AI_MODEL] || DEFAULT_MODEL;
    els.routingTarget.value = config[STORAGE_KEYS.ROUTING_TARGET] || 'google';
    els.customApiUrl.value = config[STORAGE_KEYS.CUSTOM_API_URL] || '';


    
    function collectConfig() {
        return {
            [STORAGE_KEYS.AI_API_KEY]: els.aiKey.value.trim(),
            [STORAGE_KEYS.AI_MODEL]: els.aiModel.value.trim() || DEFAULT_MODEL,
            [STORAGE_KEYS.ROUTING_TARGET]: els.routingTarget.value,
            [STORAGE_KEYS.CUSTOM_API_URL]: els.customApiUrl.value.trim(),
        };
    }

    function flashStatus(text, color) {
        els.status.style.color = color;
        els.status.textContent = text;
        clearTimeout(flashStatus._timer);
        flashStatus._timer = setTimeout(() => (els.status.textContent = ''), 2000);
    }

    function flashSaveSuccess() {
        const btn = els.save;
        if (!btn) return;
        btn.classList.add('is-success');
        btn.textContent = 'Saved';
        clearTimeout(flashSaveSuccess._timer);
        flashSaveSuccess._timer = setTimeout(() => {
            btn.classList.remove('is-success');
            btn.textContent = 'Save';
        }, 3000);
    }

    async function persist(showStatus) {
        try {
            await setConfig(collectConfig());
            if (showStatus) {
                flashSaveSuccess();
            }
        } catch (err) {
            console.error('[ScheduleAI] Failed to save config:', err);
            flashStatus('Error saving settings.', '#dc2626');
        }
    }

    
    
    let autosaveTimer = null;
    function scheduleAutosave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => persist(false), AUTOSAVE_DEBOUNCE_MS);
    }

    ['aiKey', 'aiModel', 'customApiUrl'].forEach((key) => {
        els[key].addEventListener('input', scheduleAutosave);
    });
    els.routingTarget.addEventListener('change', () => persist(false));

    els.save.addEventListener('click', () => {
        clearTimeout(autosaveTimer);
        persist(true);
    });

    const urlNote = document.getElementById('urlNormalized');
    els.customApiUrl.addEventListener('blur', () => {
        const entered = els.customApiUrl.value.trim();
        if (!entered) {
            if (urlNote) urlNote.hidden = true;
            return;
        }
        const normalized = normalizeEndpoint(entered);
        if (normalized !== entered) {
            els.customApiUrl.value = normalized;
            if (urlNote) {
                urlNote.hidden = false;
                urlNote.textContent = `Adjusted to ${normalized}`;
            }
            clearTimeout(autosaveTimer);
            persist(false);
        } else if (urlNote) {
            urlNote.hidden = true;
        }
    });



    const testBtn = document.getElementById('testAi');
    const testResult = document.getElementById('aiTestResult');

    function renderTestResult(text, variant) {
        if (!testResult) return;
        testResult.hidden = false;
        testResult.className = `test-result ${variant}`;
        testResult.textContent = text;
    }

    if (testBtn && testResult) {
        testBtn.addEventListener('click', async () => {
            await persist(false);

            testBtn.disabled = true;
            const originalText = testBtn.textContent;
            testBtn.textContent = 'Testing.';
            renderTestResult('Contacting the configured AI endpoint.', '');

            try {
                const result = await testAiConnection(collectConfig());

                const lines = [
                    result.message,
                    `Status:      ${result.status || '(no response)'}`,
                ];

                renderTestResult(lines.join('\n'), result.ok ? 'ok' : 'fail');
            } catch (err) {
                renderTestResult(
                    'Test failed unexpectedly: ' + (err?.message || err),
                    'fail'
                );
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = originalText;
            }
        });
    }



    const authBtn = document.getElementById('authGoogle');
    const revokeBtn = document.getElementById('revokeGoogle');
    const authStatus = document.getElementById('authStatus');

    function setAuthStatus(text, color) {
        if (!authStatus) return;
        authStatus.style.color = color;
        authStatus.textContent = text;
    }

    function setAuthButtonLinked(linked) {
        if (!authBtn) return;
        if (linked) {
            authBtn.classList.add('is-success');
            authBtn.textContent = 'Google Calendar Linked';
        } else {
            authBtn.classList.remove('is-success');
            authBtn.textContent = 'Link Google Calendar Account';
        }
    }

    let authLinked = false;

    async function refreshAuthStatus() {
        try {
            const { connected } = await checkGoogleAuthStatus();
            authLinked = Boolean(connected);
            setAuthButtonLinked(authLinked);
            if (!connected) {
                setAuthStatus('Not linked — click "Link Google Calendar Account".', '#b45309');
            }
        } catch (err) {
            setAuthStatus('Status unknown: ' + (err?.message || 'error'), '#dc2626');
        }
    }

    if (authBtn && authStatus) {
        authBtn.addEventListener('click', async () => {
            if (authLinked) return;

            setAuthStatus('Opening authentication…', '#666');
            try {
                const token = await getGoogleAuthToken(true);
                if (token) {
                    authLinked = true;
                    setAuthButtonLinked(true);
                    setAuthStatus('Account successfully linked ✓', '#16a34a');
                } else {
                    setAuthStatus('No token returned. Try again.', '#dc2626');
                }
            } catch (err) {
                setAuthStatus(
                    'Auth failed: ' + (err?.message || 'Unknown error'),
                    '#dc2626'
                );
            }
        });
    }

    if (revokeBtn && authStatus) {
        revokeBtn.addEventListener('click', async () => {
            if (!confirm('Disconnect Google Calendar? This will revoke access and clears the cached token.')) {
                return;
            }
            setAuthStatus('Disconnecting…', '#666');
            try {
                await revokeGoogleAuthToken();
                await refreshAuthStatus();
            } catch (err) {
                setAuthStatus('Disconnect failed: ' + (err?.message || 'error'), '#dc2626');
            }
        });
    }

    await refreshAuthStatus();

    const revealBtn = document.getElementById('revealKey');
    if (revealBtn && els.aiKey) {
        revealBtn.addEventListener('click', () => {
            const hidden = els.aiKey.type === 'password';
            els.aiKey.type = hidden ? 'text' : 'password';
            revealBtn.classList.toggle('is-revealed', hidden);
            const label = hidden ? 'Hide key' : 'Show key';
            revealBtn.setAttribute('aria-label', label);
            revealBtn.setAttribute('title', label);
        });
    }
});