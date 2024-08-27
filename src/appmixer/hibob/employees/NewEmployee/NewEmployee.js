'use strict';
const Promise = require('bluebird');
const axios = require('axios');


/**
 * Process employees to find newly added.
 * @param {Set} knownEmployees
 * @param {Array} currentEmployees
 * @param {Array} newEmployees
 * @param {Object} employee
 */
function processEmployees(knownEmployees, currentEmployees, newEmployees, employee) {
    const employeeId = employee.id;

    if (knownEmployees && !knownEmployees.has(employeeId)) {
        newEmployees.push(employee);
    }
    currentEmployees.push(employeeId);
}

/**
 * Component which triggers whenever new employee is added.
 */


class NewEmployee {

    async receive(context) {
        try {
            const auth = 'Basic ' + context.auth.token;
            let hibobEndpoint = 'https://api.hibob.com/v1/people/search';
            
            const { data } = await context.httpRequest({
                url: hibobEndpoint,
                method: "POST",
                headers: { 
                    Authorization: auth,
                },
                data: {
                    "humanReadable": "APPEND",
                    "showInactive": true,
                    "fields": [
                        "/root/firstName", 
                        "/root/surname", 
                        "/root/id", 
                        "/root/email", 
                        "/internal/status", 
                        "/work/manager"
                    ]
                },
                json: true
            });
    
            let known = Array.isArray(context.state.known) ? new Set(context.state.known) :  new Set();
            let current = [];
            let diff = [];
    
            if (data.employees) {
                data.employees.forEach(processEmployees.bind(null, known, current, diff));  
            } 
    
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            for (const employee of diff) {
                await delay(1000);
                await context.sendJson(employee, 'employee');
                // TODO: Add logging here
            }
    
            await context.saveState({
                known: current
            });
        } catch (error) {
            // TODO: Add logging here
            throw error;
        }
      
    }
} 

module.exports = new NewEmployee("maesn.hibob.employees.NewEmployee");