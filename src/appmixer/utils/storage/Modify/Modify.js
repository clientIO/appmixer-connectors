'use strict';

module.exports = {
    async receive(context) {
        const { key, operator, value, storeId } = context.messages.in.content;

        const currentEntry = await context.store.get(storeId, key);
        const oldValue = currentEntry?.value;

        let newValue = oldValue;

        switch (operator) {
            case 'Add':
                newValue = Number(oldValue || 0) + Number(value);
                break;
            case 'Subtract':
                newValue = Number(oldValue || 0) - Number(value);
                break;
            case 'Multiply':
                newValue = Number(oldValue || 0) * Number(value);
                break;
            case 'Divide':
                newValue = Number(oldValue || 0) / Number(value);
                break;
            case 'Append':
                newValue = String(oldValue || '') + String(value);
                break;
            case 'Set':
                newValue = value;
                break;
            default:
                throw new Error(`Unsupported operator: ${operator}`);
        }

        const setData = await context.store.set(storeId, key, newValue);

        return context.sendJson(Object.assign(setData, {
            oldValue,
            newValue
        }), 'out');
    }
};