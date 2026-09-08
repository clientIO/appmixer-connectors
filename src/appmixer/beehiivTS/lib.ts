import type {
    AppmixerContext,
    OutputType,
    SendArrayOutputOptions,
    ItemSchema,
    OutputPortOption
} from './types';

const pathModule = require('path') as typeof import('path');

const DEFAULT_PREFIX = 'beehiiv-objects-export';

function toCsv(array: Record<string, unknown>[]): string {
    if (!array || array.length === 0) return '';
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(item => {
            return Object.values(item).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
}

async function sendArrayOutput({
    context,
    outputPortName = 'out',
    outputType = 'array',
    records = []
}: SendArrayOutputOptions): Promise<void> {

    if (outputType === 'first') {
        if (records.length === 0) {
            throw new context.CancelError('No records available for first output type');
        }
        await context.sendJson(
            { ...records[0], index: 0, count: records.length },
            outputPortName
        );
    } else if (outputType === 'object') {
        for (let index = 0; index < records.length; index++) {
            await context.sendJson(
                { ...records[index], index, count: records.length },
                outputPortName
            );
        }
    } else if (outputType === 'array') {
        await context.sendJson({ result: records, count: records.length }, outputPortName);
    } else if (outputType === 'file') {
        const csvString = toCsv(records);
        const buffer = Buffer.from(csvString, 'utf8');
        const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
        const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
}

function getOutputPortOptions(
    context: AppmixerContext,
    outputType: OutputType,
    itemSchema: ItemSchema,
    { label, value }: { label: string; value: string }
): Promise<void> {

    if (outputType === 'object' || outputType === 'first') {
        const options: OutputPortOption[] = Object.keys(itemSchema).reduce<OutputPortOption[]>((res, field) => {
            const schema = itemSchema[field];
            const { title: fieldLabel, ...schemaWithoutTitle } = schema;
            res.push({ label: fieldLabel as string, value: field, schema: schemaWithoutTitle });
            return res;
        }, [
            { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
        ]);
        return context.sendJson(options, 'out');
    }

    if (outputType === 'array') {
        return context.sendJson([{
            label,
            value,
            schema: {
                type: 'array',
                items: { type: 'object', properties: itemSchema }
            }
        }, {
            label: 'Items Count',
            value: 'count',
            schema: { type: 'integer' }
        }], 'out');
    }

    if (outputType === 'file') {
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }

    return Promise.resolve();
}

module.exports = { sendArrayOutput, getOutputPortOptions };
