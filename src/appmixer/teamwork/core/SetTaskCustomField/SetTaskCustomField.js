'use strict';

const lib = require('../../lib');

const MINS_PER_DAY = 1440;
const DAYS_PER_WEEK = 7;

const DAYS_OF_WEEK = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
};

function toNullIfEmpty(v) {
    if (v === undefined || v === null || v === '') return null;
    return v;
}

function ensureHttps(url) {
    if (url == null || url === '') return null;
    const s = String(url).trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return `https://${s}`;
}

function apiTypeToSchemaType(apiType) {
    if (!apiType) return null;
    if (apiType.startsWith('text')) return 'text';
    if (apiType.startsWith('number')) return 'number';
    if (apiType === 'checkbox' || apiType === 'date' || apiType === 'url' || apiType === 'dropdown' || apiType === 'status' || apiType === 'list') {
        return apiType === 'list' ? 'dropdown' : apiType;
    }
    return apiType;
}

function calculateOffsetMinutes(offsetDuration, offsetPeriod) {
    if (offsetPeriod === 'day') {
        return offsetDuration * MINS_PER_DAY;
    }

    return offsetDuration * MINS_PER_DAY * DAYS_PER_WEEK;
}

const subMinutes = (date, minutes) => {
    return new Date(date.getTime() - minutes * 60000);
};
const addMinutes = (date, minutes) => {
    return new Date(date.getTime() + minutes * 60000);
};

const subDays = (date, days) => {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
};
const addDays = (date, days) => {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};
const differenceInDays = (date1, date2) => {
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

function computeTaskStartOrDueDateForAction({
    type,
    value,
    offset,
    excludeDays,
}, task) {
    let date;

    if (type === 'date') {
        date = new Date(value);
    } else {
        if (value === 'currentDate') {
            date = new Date();
        }

        if (value === 'dueDate') {
            if (!task.dueDate) {
                return 'No due date set';
            }
            date = new Date(task.dueDate);
        }

        if (value === 'startDate') {
            if (!task.startDate) {
                return 'No start date set';
            }
            date = new Date(task.startDate);
        }
    }

    const datePreOffset = new Date(date);
    const hasOffset = offset?.when !== undefined && offset?.minutes !== undefined;

    // Compute offset
    if (hasOffset) {
        const modifyMinutes = offset.when === 'before' ? subMinutes : addMinutes;

        date = modifyMinutes(date, offset.minutes);
    }

    // Compute excluded days
    if (excludeDays !== undefined && excludeDays.length > 0) {
        const excludeableDays = [1, 2, 3, 4, 5, 6, 0];

        // Prevent infinite loops occurring if all days were excluded
        if (
            excludeableDays
                .map((d) => excludeDays.includes(d))
                .filter((v) => v === true)
                .length === excludeableDays.length
        ) throw new Error('infinite loop will be caused due to excludeDays containing all days of the week');

        if (hasOffset) {
            // If there is an offset, compute the date taking into account excluded days
            //
            // To do this we:
            //   - loop through each day between the date and the offset date
            //   - check if the day should be excluded
            //   - if not, move on to the next day
            //   - if so, increment the number of days difference by 1 to account for the excluded day
            //
            // The loop uses the days difference value in the condition expression, which means an extra
            // loop iteration occurs when the days difference value increments. This allows the loop to
            // run until all excluded days have been accounted for

            const modifyDays = offset.when === 'before' ? subDays : addDays;
            let daysDiff = differenceInDays(datePreOffset, date);
            if (daysDiff < 0) daysDiff = -daysDiff;

            if (daysDiff > 365) {
                throw new Error('Invalid offset, a maximum of 365 days is allowed to be applied');
            }

            for (let i = 0; i <= daysDiff; i += 1) {
                const nextDate = modifyDays(datePreOffset, i);
                const day = nextDate.getDay();

                if (excludeDays.includes(day)) {
                    daysDiff += 1;
                }
            }

            date = modifyDays(datePreOffset, daysDiff);
        } else {
            // If there is no offset, compute to the next available day
            const findNextAvailableDay = (availableDays, day, diff = 0) => {
                if (availableDays.includes(day)) return { day, diff };

                return findNextAvailableDay(
                    availableDays,
                    day === 6 ? 0 : day + 1,
                    diff + 1,
                );
            };

            const { diff } = findNextAvailableDay(
                excludeableDays.filter((d) => excludeDays.includes(d) === false),
                date.getDay(),
            );

            date = addDays(date, diff);
        }
    }

    return date.toISOString().substring(0, 10);
}


module.exports = {

    receive: async function (context) {
        let { taskId, customFieldId, checkboxValue, numberValue, dropdownValue, textValue, dateOption, dateValue, dateDays, taskDateOffset, taskDateOffsetUnit, taskDateOffsetDirection, skipWeekends } = context.messages.in.content;
        let taskCustomField;
        let customFieldValue;

        if (!customFieldId) {
            throw new Error('Please select a custom field.');
        }

        const parts = String(customFieldId).split('-');
        const id = parseInt(parts[0], 10);
        const apiType = parts.length > 1 ? parts.slice(1).join('-') : null; // e.g. "text-short", "number-integer"
        const customFieldType = apiTypeToSchemaType(apiType);

        let resp = await lib.callAPI(
            context,
            "GET",
            `/projects/api/v3/tasks/${taskId}/customfields.json`,
            null,
            {
                "CustomFieldIDs": id.toString(),
            }
        )

        if (resp.customfieldTasks.length) {
            taskCustomField = resp.customfieldTasks[0];
        }

        switch (customFieldType) {
            case 'checkbox': {
                customFieldValue = checkboxValue === 'true' ? true : checkboxValue === 'false' ? false : null;
                break;
            }
            case 'number': {
                customFieldValue = toNullIfEmpty(numberValue);
                break;
            }
            case 'url': {
                customFieldValue = ensureHttps(textValue);
                break;
            }
            case 'text': {
                customFieldValue = toNullIfEmpty(textValue);
                break;
            }
            case 'dropdown':
            case 'status': {
                customFieldValue = toNullIfEmpty(dropdownValue);
                break;
            }
            case 'date': {
                customFieldValue = null;
                let dateParams;
                if (dateOption === 'remove-date') {
                    dateParams = { type: 'date', value: null };
                } else if (dateOption === 'choose-date' && dateValue) {
                    dateParams = { type: 'date', value: dateValue };
                } else if (dateOption === 'on-trigger-date') {
                    dateParams = { type: 'relative', value: 'currentDate', excludeDays: skipWeekends === true ? [DAYS_OF_WEEK.SATURDAY, DAYS_OF_WEEK.SUNDAY] : [], };
                } else if (dateOption === 'days-after-trigger-date' && dateDays != null) {
                    const days = parseInt(dateDays, 10) || 1;
                    dateParams = {
                        type: 'relative',
                        value: 'currentDate',
                        offset: { minutes: days * MINS_PER_DAY, when: 'after' },
                        excludeDays: skipWeekends === true ? [DAYS_OF_WEEK.SATURDAY, DAYS_OF_WEEK.SUNDAY] : [],
                    };
                } else if (dateOption === 'start-date-from-task' || dateOption === 'due-date-from-task' || dateOption === 'custom-field-value-from-task') {
                    const selectionToValueMap = {
                        'start-date-from-task': 'startDate',
                        'due-date-from-task': 'dueDate',
                        'custom-field-value-from-task': 'relativeToCustomField',
                    };

                    dateParams = {
                        type: 'relative',
                        value: selectionToValueMap[dateOption],
                        excludeDays: skipWeekends === true ? [DAYS_OF_WEEK.SATURDAY, DAYS_OF_WEEK.SUNDAY] : [],
                    };

                    if (taskDateOffset) {
                        const minutes = calculateOffsetMinutes(taskDateOffset, taskDateOffsetUnit);

                        dateParams.offset = {
                            minutes,
                            when: taskDateOffsetDirection,
                        };
                    }
                }
                if (dateParams) {
                    customFieldValue = dateParams;

                    const dateParamsToProcess = { ...dateParams };

                    if (dateParams.value === 'relativeToCustomField') {
                        if (!taskCustomField || !taskCustomField.value) {
                            throw new Error('Custom field value not set');
                        }

                        dateParamsToProcess.type = 'date';
                        dateParamsToProcess.value = new Date(taskCustomField.value);
                    }

                    let resp = await lib.callAPI(
                        context,
                        "GET",
                        `/projects/api/v3/tasks/${taskId}.json`,
                        null,
                        {},
                    )

                    if (!resp.task) {
                        throw new Error(`Task not found`);
                    }

                    const dateValueToSet = dateParams.value != null
                        ? computeTaskStartOrDueDateForAction(
                            dateParamsToProcess, resp.task,
                        ) : null;

                    customFieldValue = dateValueToSet;
                }
                break;
            }
            default:
                customFieldValue = toNullIfEmpty(textValue);
                break;
        }

        if (!taskCustomField) {
            await lib.callAPI(
                context,
                "POST",
                `/projects/api/v3/tasks/${taskId}/customfields.json`,
                {
                    customfieldTask: {
                        customfieldId: id,
                        value: customFieldValue,
                    },
                },
                null
            );
        } else if (customFieldValue == null) {
            await lib.callAPI(
                context,
                "DELETE",
                `/projects/api/v3/tasks/${taskId}/customfields/${taskCustomField.id}.json`,
                null,
                null
            );
        } else {
            await lib.callAPI(
                context,
                "PATCH",
                `/projects/api/v3/tasks/${taskId}/customfields/${taskCustomField.id}.json`,
                {
                    customfieldTask: {
                        taskCustomFieldId: taskCustomField.id, // task custom field id
                        customfieldId: id, // generic custom field id
                        value: customFieldValue,
                    },
                },
                null
            );
        }

        context.sendJson({
            taskId: taskId,
            taskCustomFieldId: taskCustomField?.id || null,
            customFieldId: customFieldId,
            customFieldValue: customFieldValue,
        }, 'task');
    },

};
