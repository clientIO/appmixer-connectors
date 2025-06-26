'use strict';

module.exports = {
    async receive(context) {
        const {
            email,
            description,
            paymentMethod,
            name,
            phone,
            addressLine1,
            addressLine2,
            addressCity,
            addressState,
            addressPostalCode,
            addressCountry,
            shippingName,
            shippingPhone,
            shippingAddressLine1,
            shippingAddressLine2,
            shippingAddressCity,
            shippingAddressState,
            shippingAddressPostalCode,
            shippingAddressCountry
        } = context.messages.in.content;

        let address;
        if (
            addressLine1 || addressLine2 || addressCity ||
            addressState || addressPostalCode || addressCountry
        ) {
            address = {
                line1: addressLine1,
                line2: addressLine2,
                city: addressCity,
                state: addressState,
                postal_code: addressPostalCode,
                country: addressCountry
            };
        }

        let shipping;
        if (
            shippingName || shippingPhone ||
            shippingAddressLine1 || shippingAddressLine2 ||
            shippingAddressCity || shippingAddressState ||
            shippingAddressPostalCode || shippingAddressCountry
        ) {
            shipping = {
                name: shippingName,
                phone: shippingPhone,
                address: {
                    line1: shippingAddressLine1,
                    line2: shippingAddressLine2,
                    city: shippingAddressCity,
                    state: shippingAddressState,
                    postal_code: shippingAddressPostalCode,
                    country: shippingAddressCountry
                }
            };
        }

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/customers',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                email,
                description,
                payment_method: paymentMethod,
                name,
                phone,
                ...(address && { address }),
                ...(shipping && { shipping })
            }
        });

        return context.sendJson(data, 'out');
    }
};
