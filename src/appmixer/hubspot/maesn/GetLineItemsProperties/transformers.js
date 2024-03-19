module.exports.lineitemToLabelNameArray = (lineitemsProperties) => {

    const transformed = [];
    if (Array.isArray(lineitemsProperties)) {
        lineitemsProperties.forEach((property) => {
            if (!property.hidden) {
                transformed.push({
                    label: property.label || property.name,
                    value: property.name
                });
            }
        });
    }
    return transformed;
};
