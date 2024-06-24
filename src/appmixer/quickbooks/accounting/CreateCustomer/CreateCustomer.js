'use strict';
const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            minorVersion,
            ...optionalInputs
        } = context.messages.in.content;

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/customer?minorversion=${minorVersion}`,
            method: 'POST',
            data: {
                PrimaryEmailAddr: {
                    Address: optionalInputs['primaryEmailAddrAddress']
                },
                DisplayName: optionalInputs['displayName'],
                ResaleNum: optionalInputs['resaleNum'],
                PreferredDeliveryMethod: optionalInputs['preferredDeliveryMethod'],
                GivenName: optionalInputs['givenName'],
                BillWithParent: optionalInputs['billWithParent'],
                Job: optionalInputs['job'],
                PrimaryPhone: {
                    FreeFormNumber: optionalInputs['primaryPhoneFreeFormNumber']
                },
                WebAddr: {
                    URI: optionalInputs['webAddrURI']
                },
                Suffix: optionalInputs['suffix'],
                Title: optionalInputs['title'],
                Mobile: {
                    FreeFormNumber: optionalInputs['mobileFreeFormNumber']
                },
                FamilyName: optionalInputs['familyName'],
                PrimaryTaxIdentifier: optionalInputs['primaryTaxIdentifier'],
                CompanyName: optionalInputs['companyName'],
                BillAddr: {
                    CountrySubDivisionCode: optionalInputs['billAddrCountrySubDivisionCode'],
                    City: optionalInputs['billAddrCity'],
                    PostalCode: optionalInputs['billAddrPostalCode'],
                    Line1: optionalInputs['billAddrLine1'],
                    Country: optionalInputs['billAddrCountry']
                },
                PrintOnCheckName: optionalInputs['printOnCheckName']
            }
        };

        context.log({ step: 'request', options });
        const response = await makeRequest({ context, options });
        return context.sendJson(response.data?.Customer, 'out');
    }
};
