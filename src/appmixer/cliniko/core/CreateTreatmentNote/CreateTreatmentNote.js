'use strict';

const lib = require('../../lib');

const RELATIONS = ['patient', 'practitioner', 'booking', 'treatment_note_template'];

module.exports = {

    async receive(context) {

        const { patientId, title, content, draft, treatmentNoteTemplateId, bookingId } = context.messages.in.content;

        if (!patientId) {
            throw new context.CancelError('Patient is required!');
        }

        let parsedContent;

        if (content) {
            try {
                parsedContent = typeof content === 'object' ? content : JSON.parse(content);
            } catch (error) {
                throw new context.CancelError('Content must be valid JSON.');
            }
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: '/treatment_notes',
            headers: { 'Content-Type': 'application/json' },
            data: Object.assign({
                // Cliniko rejects a create without `draft` ("is not included in the list"),
                // and lib.clean would strip a legitimate false - so set it unconditionally.
                draft: Boolean(draft)
            }, lib.clean({
                patient_id: patientId,
                title,
                content: parsedContent,
                treatment_note_template_id: treatmentNoteTemplateId,
                booking_id: bookingId
            }))
        });

        return context.sendJson(lib.expandIds(data, RELATIONS), 'out');
    }
};
