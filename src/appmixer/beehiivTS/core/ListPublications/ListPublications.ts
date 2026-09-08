import type {
    AppmixerContext,
    OutputType,
    BeehiivPublication,
    BeehiivApiListResponse,
    ItemSchema
} from '../../types';

const lib = require('../../lib.ts');

const SCHEMA: ItemSchema = {
    id: { type: 'string', title: 'Publication ID' },
    name: { type: 'string', title: 'Name' },
    description: { type: 'string', title: 'Description' },
    organization_name: { type: 'string', title: 'Organization Name' },
    referral_program_enabled: { type: 'boolean', title: 'Referral Program Enabled' },
    created: { type: 'integer', title: 'Created' }
};

interface ListPublicationsInput {
    outputType: OutputType;
}

interface SelectArrayItem {
    label: string;
    value: string;
}

module.exports = {

    async receive(context: AppmixerContext): Promise<void> {
        const { outputType } = context.messages.in.content as ListPublicationsInput;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, SCHEMA, { label: 'Publications', value: 'result' });
        }

        const response = await context.httpRequest<BeehiivApiListResponse<BeehiivPublication>>({
            method: 'GET',
            url: 'https://api.beehiiv.com/v2/publications',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        });

        const publications: BeehiivPublication[] = response.data.data || [];

        return lib.sendArrayOutput({ context, outputType, records: publications });
    },

    toSelectArray(msg: { result?: BeehiivPublication[] } | BeehiivPublication[]): SelectArrayItem[] {
        const items: BeehiivPublication[] = (msg as { result?: BeehiivPublication[] }).result
            || (Array.isArray(msg) ? msg : []);
        return items.map(pub => ({ label: pub.name, value: pub.id }));
    }
};
