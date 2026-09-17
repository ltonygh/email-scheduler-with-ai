import { getConfig, migrateLegacyKeys } from '../config/config.js';
import { extractSchedule } from '../ai/timeNow.js';
import { scheduleItemDispatcher } from '../calendar/dispatcher.js';
import { findConflicts } from '../calendar/googleCalendar.js';



const CONTEXT_MENU_ID = 'schedule-with-ai';
const MENU_TITLE = 'Email Scheduler with AI';

chrome.runtime.onInstalled.addListener(() => {
    migrateLegacyKeys().catch((err) =>
        console.error('[ScheduleAI] Legacy key migration failed:', err)
    );

    chrome.contextMenus.create(
        {
            id: CONTEXT_MENU_ID,
            title: MENU_TITLE,
            contexts: ['selection'],
        },
        () => {
            if (chrome.runtime.lastError) {
                console.error('[ScheduleAI] contextMenus.create failed:', chrome.runtime.lastError.message);
            }
        }
    );
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;

    const selectedText = (info.selectionText || '').trim();
    if (!selectedText) {
        notifyTab(tab, { type: 'SCHEDULE_ERROR', error: 'No text was selected.' });
        return;
    }

    notifyTab(tab, { type: 'EXTRACTION_STARTED' });

    try {
        const config = await getConfig();

        const extracted = await extractSchedule(selectedText, config);
        if (!extracted) {
            notifyTab(tab, { type: 'SCHEDULE_ERROR', error: 'Could not parse scheduling details.' });
            return;
        }

        const conflicts = await findConflicts(extracted, config);

        
        
        if (conflicts && conflicts.length > 0) {
            const sortedConflicts = [...conflicts].sort((a, b) => {
                return eventStartMs(a) - eventStartMs(b);
            });

            const earliestEvent = sortedConflicts[0];
            const multipleConflictsExist = conflicts.length > 1;
            const additionalCount = Math.max(conflicts.length - 1, 0);

        

            notifyTab(tab, {
                type: 'SHOW_CONFLICT_WARNING',
                extractedEvent: extracted,
                totalConflicts: conflicts.length,
                multipleConflictsExist,
                additionalCount,
                earliestConflict: {
                    title: earliestEvent.summary || 'Untitled Event',
                    start: earliestEvent.start?.dateTime || earliestEvent.start?.date || '',
                    end: earliestEvent.end?.dateTime || earliestEvent.end?.date || '',
                    location: earliestEvent.location || 'No location specified',
                },
                conflictingEventIds: conflicts.map((e) => e.id),
            });
            return;
        }

        notifyTab(tab, {
            type: 'SCHEDULE_READY',
            payload: { extracted },
        });
    } catch (err) {
        console.error('[SchedulerAI] Pipeline error:', {
            message: err?.message || String(err),
            status: err?.status,
            detail: err?.detail,
        });
        notifyTab(tab, { type: 'SCHEDULE_ERROR', error: err.message || String(err) });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message?.type) {
        case 'CONFIRM_WRITE':
        (async () => {
            try {
                const config = await getConfig();
                const result = await scheduleItemDispatcher(message.payload, config, {
                    overwrite: Boolean(message.overwrite),
                    conflictingEventIds: message.conflictingEventIds || []
            });
                sendResponse({ ok: true, result });
            } catch (err) {
                console.error('[ScheduleAI] CONFIRM_WRITE failed:', err);
                sendResponse({ ok: false, error: err.message || String(err) });
            }
        })();
        return true;

        case 'PING':
            sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
            return false;

        default:
            return false;
    }
});

/**
 * Resolve an event's start time to epoch milliseconds.
 * @param {object} event
 * @returns {number}
 */
function eventStartMs(event) {
    const raw = event?.start?.dateTime || event?.start?.date;
    const ms = raw ? new Date(raw).getTime() : NaN;
    return Number.isNaN(ms) ? Infinity : ms;
}

/**
 * Safely send a message to the content script of a tab.
 * @param {chrome.tabs.Tab} tab
 * @param {object} message
 */
function notifyTab(tab, message) {
    if (!tab || typeof tab.id !== 'number') return;
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}
