const inputs = {
    vulnerabilityFindings: require('./inputs.vulnerabilityFindings'),
    events: require('./inputs.events')
};

module.exports = {

    async generateInspector(context) {

        const { type } = context.properties;

        return context.sendJson({ inputs: inputs[type] }, 'out');
    }
};
