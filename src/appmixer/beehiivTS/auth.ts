import type {
    AppmixerContext,
    BeehiivApiListResponse,
    BeehiivPublication
} from './types';

interface ApiKeyField {
    type: string;
    name: string;
    tooltip: string;
}

interface ProfileInfo {
    id: string;
    name: string;
}

interface AuthDefinition {
    auth: {
        apiKey: ApiKeyField;
    };
    requestProfileInfo(context: AppmixerContext): Promise<ProfileInfo>;
    accountNameFromProfileInfo: string;
    validate(context: AppmixerContext): Promise<boolean>;
}

interface AuthModule {
    type: string;
    definition: AuthDefinition;
}

const PUBLICATIONS_URL = 'https://api.beehiiv.com/v2/publications';

const authModule: AuthModule = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your beehiiv account and find your API key in Settings > Workspace Settings > API. Requires Scale plan ($49/mo) or higher.'
            }
        },

        async requestProfileInfo(context: AppmixerContext): Promise<ProfileInfo> {
            const { data } = await context.httpRequest<BeehiivApiListResponse<BeehiivPublication>>({
                method: 'GET',
                url: PUBLICATIONS_URL,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (data?.data?.length) {
                return { id: data.data[0].id, name: data.data[0].name || 'beehiiv' };
            }
            throw new Error('Could not retrieve beehiiv account info.');
        },

        accountNameFromProfileInfo: 'name',

        validate: async (context: AppmixerContext): Promise<boolean> => {
            const response = await context.httpRequest<BeehiivApiListResponse<BeehiivPublication>>({
                method: 'GET',
                url: PUBLICATIONS_URL,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiKey}`,
                    'Accept': 'application/json'
                }
            });
            if (!response.data || !response.data.data) {
                throw new Error('Authentication failed: Invalid API key.');
            }
            return true;
        }
    }
};

module.exports = authModule;
