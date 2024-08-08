module.exports = {

    async receive(context) {

        const { accountId } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        const fields = [
            'id',
            'name',
            'status',
            'adlabels',
            'bid_strategy',
            'budget_schedule_specs',
            'time_start',
            'time_end',
            'budget_value',
            'budget_value_type',
            'recurrence_type',
            'weekly_schedule',
            'buying_type',
            'campaign_optimization_type',
            'daily_budget',
            'execution_options',
            'is_skadnetwork_attribution',
            'is_using_l3_schedule',
            'iterative_split_test_configs',
            'lifetime_budget',
            'objective',
            'promoted_object',
            'source_campaign_id',
            'special_ad_categories',
            'special_ad_category_country',
            'spend_cap',
            'start_time',
            'stop_time',
            'topline_id'
        ];

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://graph.facebook.com/v20.0/act_${accountId}/campaigns?access_token=${accessToken}&fields=${fields.join(',')}`
        });

        return context.sendJson(data, 'out');
    }
};
