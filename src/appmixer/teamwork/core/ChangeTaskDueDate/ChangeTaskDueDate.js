'use strict';

const lib = require('../../lib');

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function normalizeDateString(value) {
    const stringValue = value == null ? '' : String(value).trim();
    if (stringValue === '') return '';
    if (/^\d{8}$/.test(stringValue)) return stringValue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue.replace(/-/g, '');
    if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) return stringValue.slice(0, 10).replace(/-/g, '');
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
}

function addDays(baseDate, daysToAdd, skipWeekends) {
    const date = new Date(baseDate);
    const step = daysToAdd >= 0 ? 1 : -1;
    const totalDays = Math.abs(daysToAdd);

    if (!skipWeekends) {
        date.setDate(date.getDate() + daysToAdd);
        return formatDate(date);
    }

    let remaining = totalDays;
    while (remaining > 0) {
        date.setDate(date.getDate() + step);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            remaining -= 1;
        }
    }
    return formatDate(date);
}

function applyTaskDateOffset(baseDateString, offsetValue, offsetUnit, offsetDirection, skipWeekends) {
    const amount = Number(offsetValue ?? 1);
    if (Number.isInteger(amount) === false || amount < 0) {
        throw new Error('Offset must be a number greater than or equal to 0.');
    }

    const unitMultiplier = offsetUnit === 'week' ? 7 : 1;
    const directionMultiplier = offsetDirection === 'before' ? -1 : 1;
    const signedDays = amount * unitMultiplier * directionMultiplier;

    return addDays(new Date(baseDateString), signedDays, Boolean(skipWeekends));
}

function readTaskDateField(task, dateField) {
    if (task[dateField ] != null && String(task[dateField]).trim() !== '') {
        return task[dateField];
    }
    
    return '';
}

module.exports = {

    receive: async function (context) {
        const {
            taskId,
            dateOption,
            dueDate,
            dateDays,
            taskDateOffset,
            taskDateOffsetUnit,
            taskDateOffsetDirection,
            skipWeekends
        } = context.messages.in.content;
        let normalizedDueDate;

        switch (dateOption) {
            case 'remove-date':
                normalizedDueDate = '';
                break;
            case 'choose-date':
                normalizedDueDate = normalizeDateString(dueDate);
                if (normalizedDueDate === '') {
                    throw new Error('Please choose a date.');
                }
                break;
            case 'on-trigger-date':
                normalizedDueDate = formatDate(new Date());
                break;
            case 'days-after-trigger-date': {
                const days = Number(dateDays);
                if (Number.isInteger(days) === false || days < 0) {
                    throw new Error('Days after trigger date must be a number greater than or equal to 0.');
                }
                normalizedDueDate = addDays(new Date(), days, Boolean(skipWeekends));
                break;
            }
            case 'start-date-from-task':
            case 'due-date-from-task': {
                const taskResp = await lib.callAPI(
                    context,
                    'GET',
                    `/projects/api/v3/tasks/${taskId}.json`,
                    null,
                    {}
                );
                const task = taskResp?.task;
                if (!task) {
                    throw new Error('Task not found.');
                }

                const rawTaskDate = dateOption === 'start-date-from-task'
                    ? readTaskDateField(task, 'startDate')
                    : readTaskDateField(task, 'dueDate');

                const normalizedTaskDate = normalizeDateString(rawTaskDate);
                if (normalizedTaskDate === '') {
                    throw new Error(
                        dateOption === 'start-date-from-task'
                            ? 'Task start date is empty.'
                            : 'Task due date is empty.'
                    );
                }

                const baseDate = `${normalizedTaskDate.slice(0, 4)}-${normalizedTaskDate.slice(4, 6)}-${normalizedTaskDate.slice(6, 8)}`;
                normalizedDueDate = applyTaskDateOffset(
                    baseDate,
                    taskDateOffset,
                    taskDateOffsetUnit,
                    taskDateOffsetDirection,
                    skipWeekends
                );
                break;
            }
            default:
                throw new Error(`Unsupported date option: ${dateOption}`);
        }

        await lib.callAPI(
            context,
            'PUT',
            `/tasks/${taskId}.json`,
            {
                'todo-item': {
                    id: taskId,
                    'due-date': normalizedDueDate
                }
            },
            null
        );

        context.sendJson({
            id: taskId,
            dueDate: normalizedDueDate
        }, 'task');
    }
};
