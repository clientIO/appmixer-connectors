'use strict';

// Shared helper for the list membership components (AddContactToList,
// RemoveContactFromList): normalize the contactIds input — an array or a
// comma-separated string — into an array of non-empty string IDs.
function parseIds(value) {

    if (Array.isArray(value)) {
        return value.map((id) => String(id).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value.split(',').map((id) => id.trim()).filter(Boolean);
    }
    return [];
}

module.exports = { parseIds };
