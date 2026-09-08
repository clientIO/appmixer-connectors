module.exports = {

    async receive(context) {

        const lock = await context.lock(context.componentId);
        return context.sendJson({ lock: { resource: lock.resource, value: lock.value } }, 'out')
    }
}
