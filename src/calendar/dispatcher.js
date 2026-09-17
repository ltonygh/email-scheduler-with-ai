import { STORAGE_KEYS } from '../config/config.js';
import { writeEvent as writeGoogleEvent, deleteEvent as deleteGoogleEvent } from './googleCalendar.js';

/**
 * Normalize/route a write request based on the configured target.
 * @param {object} eventPayload { startTime, endTime, details }
 * @param {object} config       Resolved config object.
 * @param {{overwrite?:boolean, conflictingEventIds?:string[]}} [options]
 * @returns {Promise<object>}
 */
export async function scheduleItemDispatcher(eventPayload, config, options = {}) {
    const target = config[STORAGE_KEYS.ROUTING_TARGET] || 'google';

    switch (target) {
        case 'google':
        return routeToGoogle(eventPayload, config, options);

        case 'custom':
        return routeToCustomWebApp(eventPayload, config, options);

        default:
        throw new Error(`Unknown routing target: "${target}"`);
    }
}



async function routeToGoogle(eventPayload, config, options) {
    const { overwrite = false, conflictingEventIds = [] } = options;

    const created = await writeGoogleEvent(eventPayload, config);

    if (overwrite && conflictingEventIds.length > 0) {
        await deleteConflictingEvents(conflictingEventIds);
    }

    return created;
}

/**
 * Delete every conflicting event by ID, guarding against missing/blank IDs.
 * @param {string[]} eventIds
 * @returns {Promise<{deleted:string[]}>}
 */
async function deleteConflictingEvents(eventIds) {
    const ids = eventIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    const deleted = [];

    for (const id of ids) {
        await deleteGoogleEvent(id.trim());
        deleted.push(id);
    }

    return { deleted };
}



async function routeToCustomWebApp(eventPayload, config, options) {
    // TODO(custom-backend): Implement when the companion web app endpoint is ready.
    //
    //   const url = config[STORAGE_KEYS.CUSTOM_API_URL];
    //   if (!url) throw new Error('Custom API URL is not configured.');
    //
    //   const res = await fetch(url, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       // Authorization: `Bearer ${config[...CUSTOM_TOKEN...]}`,
    //     },
    //     body: JSON.stringify({ event: eventPayload, overwrite: options.overwrite }),
    //   });
    //   if (!res.ok) throw new Error(`Custom API error ${res.status}`);
    //   return res.json();

    throw new Error(
        'Custom web application API routing is not yet implemented. ' +
        'Set routingTarget back to "google" in Options.'
    );
}
