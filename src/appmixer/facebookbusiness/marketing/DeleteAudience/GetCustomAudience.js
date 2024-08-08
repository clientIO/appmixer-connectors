module.exports = {

    async receive(context) {

        const { audienceId } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        const url = `https://graph.facebook.com/v20.0/${audienceId}?access_token=${accessToken}&fields=id,name,approximate_count_lower_bound,approximate_count_upper_bound,time_created,time_updated,description`;
        const { data } = await context.httpRequest.get(url);
        return context.sendJson(data, 'out');
    }
};
