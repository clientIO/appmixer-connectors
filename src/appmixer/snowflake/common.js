// 'use strict';
const snowflake = require('snowflake-sdk');
const { promisify } = require('util');

class SnowflakeDB {

    async getConnection(context) {

        const { account, username, password, database, warehouse } = context;
        const opt = { account, username, password, database, warehouse };
        const connection = snowflake.createConnection(opt);
        await promisify(connection.connect).bind(connection)();
        return connection;
    }
    async runQuery(context, sql) {

        const connection = await this.getConnection(context);
        const executedQuery = connection.execute({
            sqlText: sql
        });
        return executedQuery;
    }
    async getRows(context, statement) {

        const connection = await this.getConnection(context);
        const executedStatement = connection.execute(statement);
        return executedStatement.streamRows();
    }
    async collectRows(context, statement) {

        const rowStream = await this.getRows(context, statement);
        const rows = [];
        for await (const row of rowStream) {
            rows.push(row);
        }
        return rows;
    }
    async listSchemas(context) {

        const sqlText = 'SHOW SCHEMAS';
        const data = await this.collectRows(context, {
            sqlText
        });
        return data;
    }
    async listTables(context, schema) {

        const sqlText = `show tables in ${context.database}.${schema};`;
        return this.collectRows(context, {
            sqlText
        });
    }
    async listColumns(context, schema, table) {

        const sqlText = `show columns in ${schema}.${table}`;
        return await this.collectRows(context, {
            sqlText
        });
    }
    async addRow(context, schema, tableName, columns, values) {

        const sqlText = `INSERT INTO ${schema}.${tableName} (${columns.join(',')}) VALUES (${values.map(val => `'${val}'`).join(',')});`;
        const statement = {
            sqlText
        };
        return await this.collectRows(context, statement);
    }
    async createStream(context, schema, tableName) {

        const sqlText = `create or replace stream  ${schema}.${tableName}_change_${context.componentId.replace(/-/gi, '')} on table ${schema}.${tableName};`;

        const statement = {
            sqlText
        };
        return this.collectRows(context.auth, statement);
    }
    async consumeStream(context, schema, tableName, triggerType) {

        const componentId = context.componentId.replace(/-/gi, '');
        let sqlText = `select * from  ${schema}.${tableName}_change_${componentId} WHERE `;
        switch (triggerType) {
            case 'insert':
                sqlText += 'metadata$action = \'INSERT\' AND metadata$isupdate = \'FALSE\';';
                break;
            case 'update':
                sqlText += '(metadata$action = \'INSERT\' AND metadata$isupdate = \'TRUE\') OR (metadata$action = \'DELETE\' AND metadata$isupdate = \'TRUE\');';
                break;
            case 'delete':
                sqlText += 'metadata$action = \'DELETE\' AND metadata$isupdate = \'FALSE\';';
                break;
            default:
                sqlText = `select * from  ${schema}.${tableName}_change_${componentId};`;
        }
        const data = await this.collectRows(context.auth, { sqlText });
        if (data.length) {
            // eslint-disable-next-line no-unused-vars
            const { METADATA$ACTION, METADATA$ISUPDATE, METADATA$ROW_ID, ...columns } = data[0];
            const columnsNames = Object.keys(columns).join();
            const dummyQuery = `insert into ${schema}.${tableName} select ${columnsNames}  from ${schema}.${tableName}_change_${componentId} where false;`;
            await this.collectRows(context.auth, { sqlText: dummyQuery });
        }
        return data || [];
    }
    async dropStream(context, schema, tableName) {

        const sqlText = `drop stream ${schema}.${tableName}_change_${context.componentId.replace(/-/gi, '')};`;
        const statement = {
            sqlText
        };
        return this.collectRows(context.auth, statement);
    }

};

module.exports = { SnowflakeDB };
