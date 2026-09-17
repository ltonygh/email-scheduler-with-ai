(function () {
    'use strict';

    const ROOT_ID = 'schedule-ai-overlay-root';



    chrome.runtime.onMessage.addListener((message) => {
        switch (message?.type) {
            case 'EXTRACTION_STARTED': {
                renderLoadingOverlay();
                break;
            }
            case 'SHOW_CONFLICT_WARNING': {
                renderConflictOverlay(message.extractedEvent, {
                    earliestConflict: message.earliestConflict,
                    totalConflicts: message.totalConflicts,
                    multipleConflictsExist: message.multipleConflictsExist,
                    additionalCount: message.additionalCount,
                    conflictingEventIds: message.conflictingEventIds || [],
                });
                break;
            }
            case 'SCHEDULE_READY': {
                const { extracted } = message.payload;
                renderCleanOverlay(extracted);
                break;
            }
            case 'SCHEDULE_ERROR':
                renderErrorOverlay(message.error);
                break;
            default:
                break;
        }
    });

    
    
    function renderLoadingOverlay() {
        const body = `
            <h2 class="sai-title">Email Scheduler with AI</h2>
            <div class="sai-loading-row">
                <span class="sai-spinner" aria-hidden="true"></span>
                <span class="sai-text">Extracting scheduling details from your selection…</span>
            </div>
            <p class="sai-text sai-text--muted">Checking the highlighted text and your calendar. This will only take a moment.</p>
        `;

        const actions = [
            { label: 'Cancel', variant: 'ghost', onClick: close },
        ];

        mountOverlay('sai-panel--loading', body, actions);
    }


    function renderConflictOverlay(extracted, conflictContext) {
        const {
            earliestConflict,
            totalConflicts,
            multipleConflictsExist,
            additionalCount,
            conflictingEventIds,
        } = conflictContext;

        let extraConflictsBadge = '';
        if (multipleConflictsExist || totalConflicts > 1) {
            const extraCount = typeof additionalCount === 'number'
                ? additionalCount
                : Math.max(totalConflicts - 1, 0);
            extraConflictsBadge = `<div class="sai-badge">+ ${extraCount} more overlapping event(s) detected in this timeframe.</div>`;
        }

        const body = `
            <h2 class="sai-title sai-title--warn">Scheduling Conflict</h2>
            <p class="sai-text">An existing event is overlapping with the stated slot:</p>
            
            <div class="sai-conflict-card">
                <div class="sai-conflict-item"><strong>Existing event:</strong> ${escapeHtml(earliestConflict.title)}</div>
                <div class="sai-conflict-item"><strong>Timeslot:</strong> ${escapeHtml(formatFriendlyTime(earliestConflict.start))} - ${escapeHtml(formatFriendlyTime(earliestConflict.end))}</div>
                <div class="sai-conflict-item"><strong>Location:</strong> ${escapeHtml(earliestConflict.location)}</div>
            </div>
            
            ${extraConflictsBadge}
            
            <p class="sai-warning-text">
                Warning: Overwriting will permanently delete these event(s) from your calendar. This action cannot be undone.
            </p>
            <p class="sai-text">Overwrite timeslot(s)?</p>
        `;

        const actions = [
            {
                label: 'Overwrite & Edit',
                variant: 'danger',
                onClick: () => {
                    renderCleanOverlay(extracted, {
                        overwrite: true,
                        conflictingEventIds: conflictingEventIds,
                    });
                },
            },
            { label: 'Cancel', variant: 'ghost', onClick: close },
        ];

        mountOverlay('sai-panel--conflict', body, actions);
    }


    
    function renderCleanOverlay(extracted, opts = {}) {
        const { startTime, endTime, details } = extracted;
        const isOverwrite = Boolean(opts.overwrite);
        const targetIds = opts.conflictingEventIds || [];

        // Static, value-free chrome only. All model/user-derived strings are set
        // via DOM properties (value/textContent) below — never via innerHTML —
        // so this form is structurally immune to HTML/script injection.
        const body = `
            <h2 class="sai-title">Confirm Schedule Details</h2>
            ${isOverwrite ? '<div class="sai-banner sai-banner--warn">Overwriting timeslot.</div>' : ''}
            <label class="sai-field">Title <input id="sai-content" type="text" /></label>
            <label class="sai-field">Start <input id="sai-start" type="datetime-local" /></label>
            <label class="sai-field">End <input id="sai-end" type="datetime-local" /></label>
            <label class="sai-field">Venue <input id="sai-venue" type="text" /></label>
            <label class="sai-field">Notes <textarea id="sai-notes" rows="2"></textarea></label>
        `;

        const actions = [
            {
                label: 'Confirm Write',
                variant: 'primary',
                onClick: (root) => {
                    const payload = readForm(root);
                    dispatchWrite(payload, isOverwrite, targetIds);
                    close();
                },
            },
            { label: 'Cancel', variant: 'ghost', onClick: close },
        ];

        mountOverlay('sai-panel--clean', body, actions, (root) => {
            // Populate fields safely via DOM properties (no HTML parsing).
            root.querySelector('#sai-content').value = details.content || '';
            root.querySelector('#sai-start').value = toLocalInput(startTime);
            root.querySelector('#sai-end').value = toLocalInput(endTime);
            root.querySelector('#sai-venue').value = details.venue || '';
            root.querySelector('#sai-notes').value = details.additionalRequirements || '';
        });
    }


    
    function renderErrorOverlay(errorMsg) {
        const body = `
            <h2 class="sai-title sai-title--warn">Scheduling Failed</h2>
            <p class="sai-text">${escapeHtml(errorMsg)}</p>
        `;

        mountOverlay('sai-panel--error', body, [
            { label: 'Dismiss', variant: 'ghost', onClick: close },
        ]);
    }


    
    function dispatchWrite(payload, overwrite, conflictingEventIds) {
        chrome.runtime.sendMessage(
            { 
                type: 'CONFIRM_WRITE', 
                payload, 
                overwrite, 
                conflictingEventIds 
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    renderErrorOverlay(chrome.runtime.lastError.message);
                    return;
                }
                if (response?.ok) {
                    toast('Event scheduled successfully.');
                } else {
                    renderErrorOverlay(response?.error || 'Unknown error.');
                }
            }
        );
    }


    
    function mountOverlay(panelClass, innerHtml, actions, onMount) {
        close();

        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.innerHTML = `
            <div class="sai-backdrop"></div>
            <div class="sai-panel ${panelClass}">
                <button class="sai-close" aria-label="Close">&times;</button>
                <div class="sai-body">${innerHtml}</div>
                <div class="sai-actions"></div>
            </div>
        `;

        const actionsHost = root.querySelector('.sai-actions');
        actions.forEach(({ label, variant, onClick }) => {
            const btn = document.createElement('button');
            btn.className = `sai-btn sai-btn--${variant}`;
            btn.textContent = label;
            btn.addEventListener('click', () => onClick(root));
            actionsHost.appendChild(btn);
        });

        root.querySelector('.sai-close').addEventListener('click', close);
        document.body.appendChild(root);

        // Populate any value-bearing fields safely (DOM properties, no HTML).
        if (typeof onMount === 'function') onMount(root);
    }

    function close() {
        document.getElementById(ROOT_ID)?.remove();
    }

    function readForm(root) {
        return {
            startTime: new Date(root.querySelector('#sai-start').value).toISOString(),
            endTime: new Date(root.querySelector('#sai-end').value).toISOString(),
            details: {
                content: root.querySelector('#sai-content').value.trim(),
                venue: root.querySelector('#sai-venue').value.trim(),
                additionalRequirements: root.querySelector('#sai-notes').value.trim(),
            },
        };
    }

    function toast(msg) {
        const t = document.createElement('div');
        t.className = 'sai-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }


    
    function toLocalInput(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function formatFriendlyTime(isoString) {
        if (!isoString) return 'Unspecified';
        const d = new Date(isoString);
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', 
            '<': '&lt;', 
            '>': '&gt;', 
            '"': '&quot;', 
            "'": '&#39;'
        }[c]));
    }
})();
