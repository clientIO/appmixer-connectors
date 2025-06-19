'use strict';

const lib = require('../../lib.generated');

module.exports = {
  async receive(context) {
    const {
      email,
      description,
      payment_method,
      name,
      phone,
      address_line1,
      address_line2,
      address_city,
      address_state,
      address_postal_code,
      address_country,
      shipping_name,
      shipping_phone,
      shipping_address_line1,
      shipping_address_line2,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      shipping_address_country
    } = context.messages.in.content;

    let address;
    if (
      address_line1 || address_line2 || address_city ||
      address_state || address_postal_code || address_country
    ) {
      address = {
        line1: address_line1,
        line2: address_line2,
        city: address_city,
        state: address_state,
        postal_code: address_postal_code,
        country: address_country
      };
    }

    let shipping;
    if (
      shipping_name || shipping_phone ||
      shipping_address_line1 || shipping_address_line2 ||
      shipping_address_city || shipping_address_state ||
      shipping_address_postal_code || shipping_address_country
    ) {
      shipping = {
        name: shipping_name,
        phone: shipping_phone,
        address: {
          line1: shipping_address_line1,
          line2: shipping_address_line2,
          city: shipping_address_city,
          state: shipping_address_state,
          postal_code: shipping_address_postal_code,
          country: shipping_address_country
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
        payment_method,
        name,
        phone,
        ...(address && { address }),
        ...(shipping && { shipping })
      }
    });

    return context.sendJson(data, 'out');
  }
};
