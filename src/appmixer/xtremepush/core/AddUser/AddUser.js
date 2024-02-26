'use strict';

const { makeRequest } = require('../../common');

module.exports = {

    async receive(context) {

        const {
            userId,
            email,
            emailSubscription,
            mobileNumber,
            smsSubscription,
            firstName,
            whatsappNumber,
            whatsappSubscription,
            language,
            timezone
        } = context.messages.in.content;
        const requestData = {
            columns: [
                'user_id',
                'email',
                'email_subscription',
                'mobile_number',
                'sms_subscription',
                'first_name',
                'whatsapp_number',
                'whatsapp_subscription',
                'language',
                'timezone'
            ],
            rows: [
                [
                    userId,
                    email,
                    Number(emailSubscription),
                    mobileNumber,
                    Number(smsSubscription),
                    firstName,
                    whatsappNumber,
                    Number(whatsappSubscription),
                    language,
                    timezone
                ]
            ]
        };
        await makeRequest({ context, options: { path: '/import/profile' , data: requestData } });
        return context.sendJson(context.messages.in.content , 'out');
    }
};

