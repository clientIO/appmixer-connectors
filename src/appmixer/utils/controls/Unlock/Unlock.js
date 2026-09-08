module.exports = {

    async receive(context) {

        return context.unlock(context.messages.in.content.lock.resource, context.messages.in.content.lock.value);
    }
}
