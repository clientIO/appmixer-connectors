business rule 


```js

function serializeGlideRecordToJSON(gr) {
    var obj = {};
    var fields = gr.getFields();

    for (var i = 0; i < fields.size(); i++) {
        var field = fields.get(i);
        var fieldName = field.getName();

        // skipping sys_id and other sensitive fields if necessary
        if (fieldName !== 'sys_id' && fieldName !== 'sys_updated_on' && fieldName !== 'sys_created_on') {
            obj[fieldName] = gr.getValue(fieldName);
        }
    }

    return obj;
}

if (current.operation() != 'insert' && current.comments.changes()) {
    if (!isConnect())
        gs.eventQueue("incident.commented", current, gs.getUserID(), gs.getUserName());
}

if (current.operation() == 'insert') {
    gs.eventQueue("incident.inserted", current, gs.getUserID(), gs.getUserName());


    var r = new sn_ws.RESTMessageV2('AppmixerNotifications', 'events');
    var requestBody = {
        "sys_id": current.toString(),
        "current": serializeGlideRecordToJSON(current)
        // Add other fields as necessary
    };

    r.setRequestBody(JSON.stringify(requestBody));
    // r.setRequestBody((requestBody));

    var response = r.execute();
    var responseBody = response.getBody();
    var httpStatus = response.getStatusCode();
}

if (current.operation() == 'update'&& !current.comments.changes()) {
    gs.eventQueue("incident.updated", current, gs.getUserID(), gs.getUserName());
}

if (!current.assigned_to.nil() && current.assigned_to.changes()) {
    gs.eventQueue("incident.assigned", current, current.assigned_to.getDisplayValue() , previous.assigned_to.getDisplayValue());
}

if (!current.assignment_group.nil() && current.assignment_group.changes()) {
    gs.eventQueue("incident.assigned.to.group", current, current.assignment_group.getDisplayValue() , previous.assignment_group.getDisplayValue());
}


if (current.priority.changes() && current.priority == 1) {
    gs.eventQueue("incident.priority.1", current, current.priority, previous.priority);
}

if (current.severity.changes() && current.severity== 1) {
    gs.eventQueue("incident.severity.1", current, current.severity, previous.severity);
}

if (current.escalation.changes() && current.escalation > previous.escalation && previous.escalation != -1) {
    gs.eventQueue("incident.escalated", current, current.escalation , previous.escalation );
}

if (current.active.changesTo(false)) {
    gs.eventQueue("incident.inactive", current, current.incident_state, previous.incident_state);
    gs.workflowFlush(current);
}

function isConnect() {
    var transaction = GlideTransaction.get();
    if (!transaction)
        return false;

    var request = transaction.getRequest();
    if (!request)
        return false;

    var path = request.getRequestURI();
    return path && path.match(/\/api\/now\/connect/);
}

```