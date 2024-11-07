'use strict';

function convertRowWithColumnsToObject(rowWithColumns) {
    const rowObject = {};
    if (rowWithColumns?.AND) {
        rowWithColumns.AND?.forEach(columnValuePair => {
            rowObject[columnValuePair.column] = columnValuePair.value;
        });
    }
    return rowObject;
}

function expressionTransformer(expressionInput) {

    const result = [];

    Object.entries(expressionInput).forEach(([key, value]) => {
        if (key === 'OR') {
            value.forEach(andObject => {
                const andGroup = [];
                Object.values(andObject).forEach((andArray) => {
                    andArray.forEach(andObject => {
                        andGroup.push(andObject);
                    });
                });
                result.push(andGroup);
            });
        } else {
            const andValue = Array.isArray(value) ? value : [value];
            andValue.forEach(andObject => {
                result.push(andObject);
            });
        }
    });

    return result;
}

function mapExpressionValues(rawValues) {

    const transformed = expressionTransformer(rawValues);
    const map = {};
    transformed.forEach(valueObject => {
        map[valueObject.column] = valueObject.value;
    });

    return map;
}

function passesFilter(row, filter) {

    if (filter.length === 0) {
        return true;
    }

    for (let andGroups of filter) {
        if (processAndClauses(row, andGroups)) {
            return true;
        }
    }

    return false;
}

function processAndClauses(row, andClauses) {

    for (let clause of andClauses) {
        if (!processClause(row, clause)) {
            return false;
        }
    }

    return true;
}

function processClause(row, clause) {

    const { column, operator, value } = clause;
    switch (operator) {
        case '=':
            return row[column] == value;
        case '!=':
            return row[column] != value;
        case '>':
            return row[column] > value;
        case '>=':
            return row[column] >= value;
        case '<':
            return row[column] < value;
        case '<=':
            return row[column] <= value;
        case 'regex':
            return row[column].match(new RegExp(value));
    }
}

function passesIndexFilter(index, indexExpression) {

    // Ensure the index expression is a string
    const indexConditions = (indexExpression + '').split(',');

    for (const indexCondition of indexConditions) {
        const result = evaluateIndexCondition(index, indexCondition);
        if (result) {
            return true;
        }
    }

    return false;
}

function evaluateIndexCondition(index, indexCondition) {

    const rangeMatch = indexCondition.match(new RegExp('([0-9]*)-([0-9]*)'));

    if (rangeMatch) {
        const lowerEnd = parseInt(rangeMatch[1]);
        const upperEnd = parseInt(rangeMatch[2]);
        return index >= lowerEnd && index <= upperEnd;
    } else {
        return index === parseInt(indexCondition);
    }
}

function indexExpressionToArray(indexExpression) {

    const indexes = [];
    const indexConditions = indexExpression.length > 0 ? indexExpression.split(',') : [];

    indexConditions.forEach(indexCondition => {
        const rangeMatch = indexCondition.match(new RegExp('([0-9]*)-([0-9]*)'));

        if (rangeMatch) {
            const lowerEnd = parseInt(rangeMatch[1]);
            const upperEnd = parseInt(rangeMatch[2]);
            for (let i = lowerEnd; i <= upperEnd; i++) {
                indexes.push(i);
            }
        } else {
            indexes.push(parseInt(indexCondition));
        }
    });

    return indexes;
}

module.exports = {
    expressionTransformer,
    convertRowWithColumnsToObject,
    mapExpressionValues,
    passesFilter,
    passesIndexFilter,
    indexExpressionToArray
};
