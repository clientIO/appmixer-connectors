'use strict';

function fromNumbersToSelectArray (numbers) {

    return (numbers || []).map(number => {
        return { label: number.phoneNumber, value: number.phoneNumber }
    });
}

module.exports = {

    getSMSAvailableNumbersArray: (numbers) => {
        const smsCapable = numbers.filter(number => {
            return number.capabilities.sms === true;
        });

        return fromNumbersToSelectArray(smsCapable);
    },

    getVoiceAvailableNumbersArray:  (numbers) => {
        const voiceCapable = numbers.filter(number => {
            return number.capabilities.voice === true;
        });

        return fromNumbersToSelectArray(voiceCapable);
    }
}
