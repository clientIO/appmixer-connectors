module.exports.taxesToLabelNameArray = (taxesProperties) => {

    const transformed = [];
    if (Array.isArray(taxesProperties)) {
        taxesProperties.forEach((property) => {
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
