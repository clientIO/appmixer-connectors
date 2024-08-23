function serializeGlideRecordToJSON(gr) {
    const obj = {};
    const fields = gr.getFields();

    for (let i = 0; i < fields.size(); i++) {
        const field = fields.get(i);
        const fieldName = field.getName();

        // skipping sys_id and other sensitive fields if necessary
        if (fieldName !== 'sys_id' && fieldName !== 'sys_updated_on' && fieldName !== 'sys_created_on') {
            obj[fieldName] = gr.getValue(fieldName);
        }
    }

    return obj;
}

if (current.operation() === 'insert') {
    gs.eventQueue('incident.inserted', current, gs.getUserID(), gs.getUserName());

    const rq = new sn_ws.RESTMessageV2('AppmixerNotifications', 'events');
    const requestBody = {
        'type': 'incident.insert',
        'data': serializeGlideRecordToJSON(current)
    };

    rq.setRequestBody(JSON.stringify(requestBody));
    rq.execute();
}

if (current.operation() === 'update' && !current.comments.changes()) {
    gs.eventQueue('incident.updated', current, gs.getUserID(), gs.getUserName());
}

if (!current.assigned_to.nil() && current.assigned_to.changes()) {
    gs.eventQueue('incident.assigned', current, current.assigned_to.getDisplayValue(), previous.assigned_to.getDisplayValue());
}

if (!current.assignment_group.nil() && current.assignment_group.changes()) {
    gs.eventQueue('incident.assigned.to.group', current, current.assignment_group.getDisplayValue(), previous.assignment_group.getDisplayValue());
}

if (current.priority.changes() && current.priority === 1) {
    gs.eventQueue('incident.priority.1', current, current.priority, previous.priority);
}

if (current.severity.changes() && current.severity === 1) {
    gs.eventQueue('incident.severity.1', current, current.severity, previous.severity);
}

if (current.escalation.changes() && current.escalation > previous.escalation && previous.escalation !== -1) {
    gs.eventQueue('incident.escalated', current, current.escalation, previous.escalation);
}

if (current.active.changesTo(false)) {
    gs.eventQueue('incident.inactive', current, current.incident_state, previous.incident_state);
    gs.workflowFlush(current);
}
