module.exports = {

    toSelectArray(items) {

        return items.result.map(item => {

            return {
                label: item['label'],
                value: item['name']
            };
        });
    }
};
