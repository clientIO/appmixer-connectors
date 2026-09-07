'use strict';

const { getFhirBaseUrl, getOauthBaseUrl } = require('./lib');

// Read-only SMART on FHIR scopes covering every resource type this connector
// reads. Adding scopes later is a breaking change (users must re-authenticate).
const SCOPES = [
    'openid',
    'fhirUser',
    'user/Patient.read',
    'user/Condition.read',
    'user/Observation.read',
    'user/Medication.read',
    'user/MedicationRequest.read',
    'user/Procedure.read',
    'user/CarePlan.read',
    'user/Goal.read',
    'user/Immunization.read',
    'user/DiagnosticReport.read',
    'user/DocumentReference.read',
    'user/Device.read',
    'user/Appointment.read'
];

async function exchangeToken(context, data) {

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    };

    if (context.clientSecret) {
        // Epic requires confidential clients to authenticate with HTTP Basic auth.
        // Sending client_secret in the request body results in 'invalid_client'.
        const credentials = Buffer.from(`${context.clientId}:${context.clientSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        delete data.client_id;
    }

    const response = await context.httpRequest({
        method: 'POST',
        url: `${getOauthBaseUrl(context)}/token`,
        headers,
        data: new URLSearchParams(data).toString()
    });

    const token = response.data;
    const expiresIn = Number(token.expires_in) || 3600;

    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        accessTokenExpDate: new Date(Date.now() + expiresIn * 1000)
    };
}

module.exports = {

    type: 'oauth2',

    definition: {

        scope: SCOPES,

        scopeDelimiter: ' ',

        authUrl: context => {

            const params = new URLSearchParams({
                response_type: 'code',
                client_id: context.clientId,
                redirect_uri: context.callbackUrl,
                scope: context.scope.join(' '),
                state: context.ticket,
                // Epic requires the FHIR base URL of the target organisation
                // as the audience.
                aud: getFhirBaseUrl(context)
            });

            return `${getOauthBaseUrl(context)}/authorize?${params.toString()}`;
        },

        requestAccessToken: context => {

            const data = {
                grant_type: 'authorization_code',
                code: context.authorizationCode,
                redirect_uri: context.callbackUrl,
                client_id: context.clientId
            };

            return exchangeToken(context, data);
        },

        refreshAccessToken: context => {

            const data = {
                grant_type: 'refresh_token',
                refresh_token: context.refreshToken,
                client_id: context.clientId
            };

            return exchangeToken(context, data);
        },

        requestProfileInfo: context => {

            // Epic (sandbox included) has no userinfo endpoint. The access token is
            // a JWT — decode its claims locally instead of making an HTTP call.
            try {
                const payload = context.accessToken.split('.')[1];
                const claims = JSON.parse(Buffer.from(payload, 'base64').toString());
                return { sub: claims.sub, fhirUser: claims.fhirUser };
            } catch (error) {
                return {};
            }
        },

        accountNameFromProfileInfo: context => {

            const profile = context.profileInfo || {};
            return profile.fhirUser
                || profile.name
                || profile.preferred_username
                || profile.sub
                || 'Epic FHIR Account';
        },

        validateAccessToken: context => {

            return !!context.accessToken;
        }
    }
};
