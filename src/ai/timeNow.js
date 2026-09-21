import { STORAGE_KEYS } from '../config/config.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

/**
 * Ensure a custom endpoint points at the OpenAI-compatible chat-completions
 * route. If the user omits the trailing path (e.g. "https://api.deepseek.com"
 * or "http://localhost:11434"), we append "/v1/chat/completions". Existing
 * correct URLs (and any non-standard path the user set deliberately) are kept.
 * @param {string} url
 * @returns {string}
 */
export function normalizeEndpoint(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return trimmed;

    // Strip any trailing slash(es) for consistent comparison.
    const withoutSlash = trimmed.replace(/\/+$/, '');

    if (withoutSlash.toLowerCase().endsWith(CHAT_COMPLETIONS_PATH)) {
        return withoutSlash;
    }

    return `${withoutSlash}${CHAT_COMPLETIONS_PATH}`;
}



export const SCHEDULE_JSON_SCHEMA = {
    type: 'object',
    properties: {
        startTime: {
            type: 'string',
            description: 'Event start time in ISO 8601 format.',
        },
        endTime: {
            type: 'string',
            description: 'Event end time in ISO 8601 format.',
        },
        details: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description:
                        'Very short event title (2-6 words) stating only the action. ' +
                        'No venue, no time, no explanatory clauses.',
                },
                venue: {
                    type: 'string',
                    description: 'Location or venue only; empty string if unspecified.',
                },
                additionalRequirements: {
                    type: 'string',
                    description:
                        'One short sentence with the most important extra detail ' +
                        '(e.g. a deadline). Do not restate title or venue; empty string if none.',
                },
            },
            required: ['content', 'venue', 'additionalRequirements'],
        },
    },
    required: ['startTime', 'endTime', 'details'],
};

/**
 * Capture machine time as ISO 8601 string.
 * @returns {string}
 */
export function captureCurrentMachineTime() {
    const now = new Date();

    const localString = now.toLocaleString('en-US', {
        timeZoneName: 'short',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });
  
    return localString;
}

/**
 * Build a deterministic date reference for the model to look up.
 * @param {Date} now
 * @returns {string}
 */
function buildDateReference(now) {
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekdayName = (d) =>
        d.toLocaleDateString('en-US', { weekday: 'long' });

    const atMidnight = (offsetDays) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offsetDays);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const dayNames = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday',
    ];
    const upcomingLines = dayNames.map((name, idx) => {
        let delta = (idx - now.getDay() + 7) % 7;
        if (delta === 0) delta = 7; //
        const d = atMidnight(delta);
        return `   - ${name}: ${ymd(d)} (${delta} day${delta === 1 ? '' : 's'} from today)`;
    });

    return [
        `   - Today: ${ymd(now)} (${weekdayName(now)})`,
        `   - Tomorrow: ${ymd(atMidnight(1))} (${weekdayName(atMidnight(1))})`,
        `   - Day after tomorrow: ${ymd(atMidnight(2))} (${weekdayName(atMidnight(2))})`,
        '   - Upcoming weekday dates (the next occurrence of each day, AFTER today):',
        ...upcomingLines,
    ].join('\n');
}

/**
 * Extract scheduling details from raw highlighted text.
 * @param {string} rawText
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function extractSchedule(rawText, config) {
    const apiKey = (config[STORAGE_KEYS.AI_API_KEY] || '').trim();

    const customUrl = (config[STORAGE_KEYS.CUSTOM_API_URL] || '').trim();
    const isCustomEndpoint = customUrl.length > 0;
    const endpoint = isCustomEndpoint ? normalizeEndpoint(customUrl) : OPENROUTER_ENDPOINT;

    const model = (config[STORAGE_KEYS.AI_MODEL] || '').trim();

    if (!model) {
        throw new Error(
            'No AI model configured. Set a model in Options (e.g. qwen2.5:7b for Ollama, deepseek-chat for DeepSeek).',
        );
    }

    if (!isCustomEndpoint && !apiKey) {
        throw new Error(
            'No AI endpoint configured. Set a Custom API URL if the model is local, or add an API key for OpenRouter.',
        );
    }

    const now = new Date();
    const nowIso = captureCurrentMachineTime();
    const prompt = buildPrompt(rawText, nowIso, now);

    const requestBody = buildRequestBody(endpoint, model, prompt);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: buildHeaders(endpoint, apiKey),
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw buildAiError(response.status, await safeReadText(response), {
            endpoint,
            model,
            isCustomEndpoint,
            hasKey: Boolean(apiKey),
        });
    }

    const data = await response.json();


    
    const jsonText = data?.choices?.[0]?.message?.content;
    if (!jsonText) {
        throw new Error('AI provider returned an empty response.');
    }

    const cleaned = stripCodeFences(jsonText);
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error('AI response was not valid JSON.');
    }

    validateScheduleShape(parsed);
    sanitizeTextFields(parsed);
    warnOnSuspectDate(parsed, rawText, new Date());

    return parsed;
}

const MAX_TITLE_LEN = 120;
const MAX_VENUE_LEN = 160;
const MAX_NOTES_LEN = 500;

/**
 * Sanitize the text-bearing fields of an extracted schedule.
 * @param {object} parsed
 */
function sanitizeTextFields(parsed) {
    const d = parsed?.details;
    if (!d || typeof d !== 'object') return;

    d.content = sanitizeText(d.content, MAX_TITLE_LEN);
    d.venue = sanitizeText(d.venue, MAX_VENUE_LEN);
    d.additionalRequirements = sanitizeText(d.additionalRequirements, MAX_NOTES_LEN);
}

/**
 * Turn an arbitrary string into safe plain text.
 * @param {string} input
 * @param {number} maxLen
 * @returns {string}
 */
function sanitizeText(input, maxLen) {
    let s = String(input ?? '');

    try {
        s = s.normalize('NFC');
    } catch { }

    s = s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
    s = stripTags(s);
    s = stripDangerousSchemes(s);
    s = decodeBasicEntities(s);
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > maxLen) s = s.slice(0, maxLen).trim();

    return s;
}

/**
 * Remove tags while preserving inner text
 * @param {string}
 * @returns {string}
 */
function stripTags(s) {
    let out = s;
    let prev;
    do {
        prev = out;
        out = out.replace(/<[^>]*>/g, '');
    } while (out !== prev);
    out = out.replace(/<(?=\s*$)/, '');
    return out;
}

/**
 * Remove javascript:/data:/vbscript: schemes
 * @param {string} s
 * @returns {string}
 */
function stripDangerousSchemes(s) {
    return s.replace(/\b(javascript|vbscript|data)\s*:/gi, '$1\uFF1A');
}

const BASIC_ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
};

/**
 * Decode only the handful of entities needed for readable plain text.
 * @param {string} s
 * @returns {string}
 */
function decodeBasicEntities(s) {
    let out = s;
    let prev;
    do {
        prev = out;
        out = out.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => BASIC_ENTITIES[m] || m);
    } while (out !== prev);
    return out;
}

/**
 * Heuristically warn when an extracted start date is implausible.
 * @param {object} parsed
 * @param {string} rawText
 * @param {Date} now
 */
function warnOnSuspectDate(parsed, rawText, now) {
    try {
        const start = new Date(parsed.startTime);
        if (Number.isNaN(start.getTime())) return;

        const startDay = new Date(start);
        startDay.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        if (startDay < today) {
            console.warn(
                '[ScheduleAI] Extracted start date is in the PAST:',
                parsed.startTime,
                '(today is', today.toISOString().slice(0, 10) + ')'
            );
        }

        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const mentioned = weekdays.find((d) =>
            new RegExp(`\\b${d}\\b`, 'i').test(rawText)
        );
        if (mentioned) {
            const actual = weekdays[start.getDay()];
            if (actual !== mentioned) {
                console.warn(
                    `[ScheduleAI] Text mentions "${mentioned}" but extracted date`,
                    parsed.startTime,
                    `falls on a ${actual}.`
                );
            }
        }
    } catch { }
}

/**
 * Allow user to verify connectivity of the AI endpoint
 * @param {object} config
 * @returns {Promise<{ok:boolean, status:number, endpoint:string, model:string,
 *   isCustomEndpoint:boolean, hasKey:boolean, detail:string, message:string}>}
 */
export async function testAiConnection(config) {
    const apiKey = (config[STORAGE_KEYS.AI_API_KEY] || '').trim();
    const customUrl = (config[STORAGE_KEYS.CUSTOM_API_URL] || '').trim();
    const isCustomEndpoint = customUrl.length > 0;
    const endpoint = isCustomEndpoint ? normalizeEndpoint(customUrl) : OPENROUTER_ENDPOINT;
    const model = (config[STORAGE_KEYS.AI_MODEL] || '').trim();

    const base = { status: 0, endpoint, model, isCustomEndpoint, hasKey: Boolean(apiKey), detail: '' };

    if (!model) {
        return {
            ...base,
            ok: false,
            message:
                'No AI model configured. Set a model in Options (e.g. qwen2.5:7b for Ollama, deepseek-chat for DeepSeek).',
        };
    }

    if (!isCustomEndpoint && !apiKey) {
        return {
            ...base,
            ok: false,
            message:
                'No AI endpoint configured. Set a Custom API URL if the model is local, or add an API key for OpenRouter.',
        };
    }

    const requestBody = {
        model,
        messages: [
            { role: 'system', content: 'Reply with a tiny JSON object.' },
            { role: 'user', content: 'Return {} as JSON.' },
        ],
        temperature: 0,
        max_tokens: 16,
        response_format: supportsJsonSchema(endpoint)
            ? {
                type: 'json_schema',
                json_schema: {
                    name: 'ConnectionProbe',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false,
                    },
                },
            }
            : { type: 'json_object' },
    };

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: buildHeaders(endpoint, apiKey),
            body: JSON.stringify(requestBody),
        });
    } catch (err) {
        return {
            ...base,
            ok: false,
            message:
                'Could not reach the endpoint. ' +
                `(${err?.message || err})`,
        };
    }

    const detail = await safeReadText(response);

    if (!response.ok) {
        return {
            ...base,
            ok: false,
            status: response.status,
            detail,
            message: explainStatus(response.status, isCustomEndpoint),
        };
    }

    return {
        ...base,
        ok: true,
        status: response.status,
        detail: truncate(detail, 600),
        message: 'Connection OK. The endpoint is listening.',
    };
}

/**
 * Build an Error with a status-specific, actionable message.
 * @param {number} status
 * @param {string} detail
 * @param {object} meta
 * @returns {Error}
 */
function buildAiError(status, detail, meta) {
    const context =
        `[endpoint=${meta.endpoint} model=${meta.model} ` +
        `custom=${meta.isCustomEndpoint} keyPresent=${meta.hasKey}]`;
    const hint = explainStatus(status, meta.isCustomEndpoint);
    const err = new Error(
        `AI request failed (${status}): ${hint} ${context} Details: ${truncate(detail, 500)}`
    );
    err.status = status;
    err.detail = detail;
    return err;
}

/**
 * Map an HTTP status to a short, actionable explanation.
 * @param {number} status
 * @param {boolean} isCustomEndpoint
 * @returns {string}
 */
function explainStatus(status, isCustomEndpoint) {
    switch (status) {
        case 401:
            return 'Unauthorized. The API key may be missing, malformed, or expired.';
        case 403:
            return isCustomEndpoint
                ? 'Forbidden by the local/self-hosted server. If this is Ollama, set ' +
                  'OLLAMA_ORIGINS=chrome-extension://* and restart the server, and verify the ' +
                  'URL ends with /v1/chat/completions.'
                : 'Forbidden. usually an invalid/restricted key, exhausted credits/quota, ' +
                  'a model your key cannot access, or a blocked origin.';
        case 404:
            return 'Not found. The URL path or the model name is wrong for this provider.';
        case 429:
            return 'Rate limited or quota exceeded. Slow down or check your plan limits.';
        case 400:
            return 'Bad request. The provider rejected the payload.';
        case 402:
            return 'Payment required. The account is out of credit.';
        default:
            if (status >= 500) {
                return 'Server error. The provider is having trouble; retry shortly.';
            }
            return 'Request rejected, See Details for the provider message.';
    }
}

function truncate(str, max) {
    const s = String(str || '');
    return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Build the chat-completions request body, choosing a response_format the that the respective endpoint supports.
 * @param {string} endpoint
 * @param {string} model
 * @param {string} prompt
 * @returns {object}
 */
function buildRequestBody(endpoint, model, prompt) {
    const body = {
        model,
        messages: [
            {
                role: 'system',
                content:
                    'You are an expert scheduling extraction engine. Respond with a single JSON object matching the schema. Do not include markdown or code fences.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
    };

    if (supportsJsonSchema(endpoint)) {
        body.response_format = {
            type: 'json_schema',
            json_schema: {
                name: 'ScheduleSchema',
                strict: true,
                schema: SCHEDULE_JSON_SCHEMA,
            },
        };
    } else {
        body.response_format = { type: 'json_object' };
    }

    return body;
}

/**
 * Whether an endpoint supports OpenAI Structured Outputs.
 * @param {string} endpoint
 * @returns {boolean}
 */
function supportsJsonSchema(endpoint) {
    const host = safeHostname(endpoint);
    return host.includes('openrouter.ai') || host.includes('api.openai.com');
}

/**
 * Build request headers.
 * @param {string} endpoint
 * @param {string} apiKey
 * @returns {object}
 */
function buildHeaders(endpoint, apiKey) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    if (isOpenRouterEndpoint(endpoint)) {
        headers['HTTP-Referer'] = 'https://github.com/schedule-with-ai';
        headers['X-Title'] = 'Email Scheduler with AI';
    }

    return headers;
}

function isOpenRouterEndpoint(endpoint) {
    return safeHostname(endpoint).includes('openrouter.ai');
}

/**
 * Extract the hostname from a URL string without throwing on malformed input.
 * @param {string} endpoint
 * @returns {string}
 */
function safeHostname(endpoint) {
    try {
        return new URL(endpoint).hostname;
    } catch {
        return '';
    }
}

/**
 * Strip fences defensively before parsing.
 * @param {string} text
 * @returns {string}
 */
function stripCodeFences(text) {
    return String(text)
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
}



function buildPrompt(rawText, localTimeContext, now) {
    const dateReference = buildDateReference(now);

    return [
        'You are an expert scheduling extraction engine.',
        `CRITICAL CONTEXT: The user's current local clock time is: ${localTimeContext}.`,
        '',
        'DATE RESOLUTION — READ CAREFULLY:',
        'You MUST resolve every relative date using the reference table below.',
        'Do NOT rely on your own assumptions about the current calendar date.',
        'Look the answer up in this table instead of computing it:',
        dateReference,
        'Interpretation rules:',
        ' - "tomorrow" / "the day after tomorrow" -> use the exact date listed above.',
        ' - "next <weekday>" (e.g. "next Monday") -> the upcoming <weekday> date listed above.',
        ' - "<weekday>" or "this <weekday>" -> the upcoming <weekday> date listed above.',
        ' - If a weekday is named AND a specific calendar date is given, prefer the explicit date.',
        ' - Time-of-day with no timezone -> use the same local timezone as the clock above, and '
        + 'keep the clock time exactly as stated (do not shift the hour for timezones).',
        '',
        'Task: Extract a single calendar event from the email text below.',
        'Return ONLY a valid JSON object matching the requested schema. Do not include markdown formatting or backticks.',
        '',
        'FIELD RULES (follow strictly):',
        '1. details.content (the calendar TITLE):',
        '   - A SHORT action phrase of 2 to 6 words, like a calendar subject line.',
        '   - State only what is being done. Do NOT include the venue, the time, dates, or long explanatory clauses such as "...to handle X" or "...because of Y".',
        '   - Title-case it. No trailing period.',
        '2. details.venue:',
        '   - Only the location/place on its own (e.g. "2/F meeting room"). Never repeat it in the title.',
        '3. details.additionalRequirements (the NOTES):',
        '   - The single most important extra instruction, things to do during the meeting from the text, quoted or paraphrased faithfully in ONE short sentence.',
        '   - Do NOT invent, embellish, or restate the title or venue here. If there is no notable extra detail, use an empty string "".',
        '4. startTime / endTime:',
        '   - Set the DATE from the reference table above and the TIME from the email.',
        '   - Output full ISO 8601 strings with the local timezone offset.',
        '   - If a duration or "roughly N minutes" / "about N minutes" is given, add it to the start to get the end time.',
        '',
        'EXAMPLE',
        'Email: "Please meet tomorrow in the 2/F meeting room at 9:00am for roughly 10 minutes to handle this issue ASAP before 11:00am."',
        '(Given: today is Monday 2025-09-15, tomorrow is 2025-09-16.)',
        'Correct output:',
        '  startTime = the ISO string for 2025-09-16 09:00 local',
        '  endTime   = the ISO string for 2025-09-16 09:10 local  (9:00 + 10 minutes)',
        '  details.content = "Security Breach Meeting"  (short, no venue, no reason clause)',
        '  details.venue   = "2/F meeting room"',
        '  details.additionalRequirements = "Handle the security breach before 11:00am."',
        'Wrong output (do NOT do this): a long title, or a date taken from a previous message '
        + 'instead of the reference table above.',
        '',
        '--- EMAIL TEXT START ---',
        rawText,
        '--- EMAIL TEXT END ---',
    ].join('\n');
}

function validateScheduleShape(obj) {
    const valid =
        obj &&
        typeof obj.startTime === 'string' &&
        typeof obj.endTime === 'string' &&
        obj.details &&
        typeof obj.details.content === 'string';
    if (!valid) {
        throw new Error('Extracted schedule did not match the expected shape.');
    }
    if (Number.isNaN(Date.parse(obj.startTime)) || Number.isNaN(Date.parse(obj.endTime))) {
        throw new Error('Extracted times are not valid ISO dates.');
    }
}

async function safeReadText(res) {
    try {
        return await res.text();
    } catch {
        return '<no body>';
    }
}
