module.exports = {
    extractIPs(expression) {
        // Regular expression to match IP addresses within the curly braces
        // const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
        // Extracting the section of the expression that contains the IPs

        const match = expression.match(/{([^}]+)}/);
        if (!match) {
            // If no match for IP address block found, return empty array
            return [];
        }

        const ipsBlock = match[1]; // This contains "192.0.2.0 192.0.2.2 192.0.2.3"
        return ipsBlock.split(' ');
    },

    getIpsFromRules(rules) {

        const ips = new Set();
        rules.forEach(rule => {

            const data = this.extractIPs(rule.expression);
            data.forEach(item => ips.add(item));

        });

        return ips;
    },

    OUTPUT_PORT: {
        SUCCESS: 'success',
        FAILURE: 'failure'
    }

};

// function extractIps(expression) {
//     const ipRegex = /ip\.src eq (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
//
//     const ipRegex = /ip\.src in \{([\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?: \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})*)\}/g;
//     const ips = [];
//     let match;
//     while ((match = ipRegex.exec(expression)) !== null) {
//         const matchedIps = match[1].split(' ');
//         ips.push(...matchedIps);
//     }
//     return ips;
// }
