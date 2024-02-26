'use strict';
const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            minorVersion,
            ...optionalInputs
        } = context.messages.in.content;

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/vendor?minorversion=${minorVersion}`,
            method: 'POST',
            data: {
                PrimaryEmailAddr: {
                    Address: optionalInputs['primaryEmailAddrAddress']
                },
                WebAddr: {
                    URI: optionalInputs['webAddrURI']
                },
                PrimaryPhone: {
                    FreeFormNumber: optionalInputs['primaryPhoneFreeFormNumber']
                },
                DisplayName: optionalInputs['displayName'],
                Suffix: optionalInputs['suffix'],
                Title: optionalInputs['title'],
                Mobile: {
                    FreeFormNumber: optionalInputs['mobileFreeFormNumber']
                },
                FamilyName: optionalInputs['familyName'],
                TaxIdentifier: optionalInputs['taxIdentifier'],
                AcctNum: optionalInputs['acctNum'],
                CompanyName: optionalInputs['companyName'],
                BillAddr: {
                    CountrySubDivisionCode: optionalInputs['billAddrCountrySubDivisionCode'],
                    City: optionalInputs['billAddrCity'],
                    PostalCode: optionalInputs['billAddrPostalCode'],
                    Line1: optionalInputs['billAddrLine1'],
                    Country: optionalInputs['billAddrCountry']
                },
                GivenName: optionalInputs['givenName'],
                PrintOnCheckName: optionalInputs['printOnCheckName']
            }
        };

        context.log({ step: 'request', options });
        const response = await makeRequest({ context, options });
        return context.sendJson(response.data?.Vendor, 'out');
    }
};
