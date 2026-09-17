import { getGoogleAuthToken } from '../config/config.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Query Google Calendar for events overlapping the extracted timeframe.
 * @param {{startTime:string, endTime:string}} extracted
 * @param {object} config
 * @returns {Promise<Array>}
 */
export async function findConflicts(extracted, config) {
    const token = await getGoogleAuthToken(false);

    const params = new URLSearchParams({
        timeMin: extracted.startTime,
        timeMax: extracted.endTime,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '10',
    });

    const res = await fetch(
        `${CALENDAR_API}/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
        const detail = await res.text().catch(() => '<no body>');
        throw new Error(`Calendar conflict query failed (${res.status}): ${detail}`);
    }

    const data = await res.json();
    return data.items || [];
}



export async function deleteEvent(eventId) {
    const token = await getGoogleAuthToken(true);

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '<no body>');
        throw new Error(`Failed to delete conflicting event ${eventId}: ${detail}`);
    }

    return true;
}

/**
 * Create a calendar event from the extracted/edited schedule payload.
 * @param {object} eventPayload
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function writeEvent(eventPayload, config) {
    const token = await getGoogleAuthToken(true);

    const body = mapToGoogleEvent(eventPayload);

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '<no body>');
        throw new Error(`Calendar event creation failed (${res.status}): ${detail}`);
    }

    return res.json();
}



function mapToGoogleEvent({ startTime, endTime, details }) {
    return {
        summary: safePlainText(details?.content || 'Scheduled Event', 120),
        location: safePlainText(details?.venue, 160) || undefined,
        description: safePlainText(details?.additionalRequirements, 500) || undefined,
        start: { dateTime: toRfc3339(startTime) },
        end: { dateTime: toRfc3339(endTime) },
    };
}

/**
 * Final write-time guard: turn arbitrary text into plain text before it leaves
 * the extension for Google Calendar (which renders descriptions as HTML and may
 * relay content to other attendees). Strips tags (keeping inner text), removes
 * dangerous URL schemes and control characters, collapses whitespace, caps length.
 * @param {string} input
 * @param {number} maxLen
 * @returns {string}
 */
function safePlainText(input, maxLen) {
    let s = String(input ?? '');
    try {
        s = s.normalize('NFC');
    } catch {
        // Older engines: skip normalization.
    }
    s = s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
    let out = s;
    let prev;
    do {
        prev = out;
        out = out.replace(/<[^>]*>/g, '');
    } while (out !== prev);
    out = out.replace(/\b(javascript|vbscript|data)\s*:/gi, '$1\uFF1A');
    out = out.replace(/\s+/g, ' ').trim();
    if (out.length > maxLen) out = out.slice(0, maxLen).trim();
    return out;
}

function toRfc3339(isoString) {
    return new Date(isoString).toISOString();
}