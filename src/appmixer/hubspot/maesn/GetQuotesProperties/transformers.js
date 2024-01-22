module.exports.quoteToLabelNameArray = (quotesProperties) => {

    const transformed = [];
    if (Array.isArray(quotesProperties)) {
        quotesProperties.forEach((property) => {
            if (!property.hidden) {
                transformed.push({
                    label: property.label || property.name,
                    value: property.name
                });
            }
        });
    }
    return transformed;
}
