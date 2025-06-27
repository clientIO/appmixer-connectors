var blockedIPsEntry = context.getVariable('blocked-ips');
var blockedIPs = [];
var activeBlockedIPs = [];

print('KV raw value type: ' + typeof blockedIPsEntry);
print('KV raw value length: ' + (blockedIPsEntry ? blockedIPsEntry.length : 'null'));

if (blockedIPsEntry) {

    try {
        // Parse the object structure
        var blockedIPsObject = JSON.parse(blockedIPsEntry);

        print('Successfully parsed KVM object');
        print('Number of entries: ' + Object.keys(blockedIPsObject).length);

        var currentTime = new Date();

        // Process each IP entry
        Object.keys(blockedIPsObject).forEach(function(ip) {
            var entry = blockedIPsObject[ip];

            // Check if entry has expiration and if it's still valid
            if (entry.expiration) {
                var expirationDate = new Date(entry.expiration);
                if (expirationDate > currentTime) {
                    activeBlockedIPs.push({
                        ip: entry.ip,
                        comment: entry.comment,
                        expiration: entry.expiration
                    });
                    blockedIPs.push(entry.ip); // Just the IP for simple checks
                } else {
                    print('IP ' + ip + ' has expired, skipping');
                }
            } else {
                // No expiration, always active
                activeBlockedIPs.push(entry);
                blockedIPs.push(entry.ip);
            }
        });

        print('Active blocked IPs: ' + JSON.stringify(blockedIPs));
        print('Total active entries: ' + activeBlockedIPs.length);

        // Set flow variables
        context.setVariable('blocked.ips.simple', JSON.stringify(blockedIPs));
        context.setVariable('blocked.ips.detailed', JSON.stringify(activeBlockedIPs));
        context.setVariable('blocked.ips.count', blockedIPs.length.toString());
        context.setVariable('blocked.ips.loaded', 'true');

    } catch (e) {
        print('Error parsing blocked IPs: ' + e.message);
        print('Raw value (first 500 chars): ' + (blockedIPsEntry ? blockedIPsEntry.substring(0, 500) : 'null'));

        // Set error state
        context.setVariable('blocked.ips.simple', '[]');
        context.setVariable('blocked.ips.detailed', '[]');
        context.setVariable('blocked.ips.count', '0');
        context.setVariable('blocked.ips.loaded', 'false');
        context.setVariable('blocked.ips.error', e.message);
    }
} else {
    print('No blocked IPs entry found in KVM');
    context.setVariable('blocked.ips.simple', '[]');
    context.setVariable('blocked.ips.count', '0');
    context.setVariable('blocked.ips.loaded', 'false');
}

print('xx: ' + clientIP);
var blockedIPsEntry = context.getVariable('blocked-ips');
var blockedIPs = [];
print('kv: ' + blockedIPsEntry);
try {
    blockedIPs = JSON.parse(blockedIPsEntry || '[]');
    print('blocked IPs: ' + JSON.stringify(blockedIPs));
} catch (e) {
    print('Error parsing blocked IPs: ' + e);
    blockedIPs = [];
}

var clientIP = context.getVariable('request.header.X-Forwarded-For') || context.getVariable('request.ip');

if (clientIP && clientIP.indexOf(',') > -1) {
    clientIP = clientIP.split(',')[0].trim();
}
// Separate individual IPs from CIDR ranges
var individualIPs = [];
var cidrRanges = [];

blockedIPs.forEach(function(entry) {
    if (entry.indexOf('/') > -1) {
        cidrRanges.push(entry);
    } else {
        individualIPs.push(entry);
    }
});

// // Check if IP is blocked
var isBlocked = individualIPs.indexOf(clientIP) > -1;
//
// // Check CIDR ranges if not already blocked
// if (!isBlocked && cidrRanges.length > 0) {
//     for (var i = 0; i < cidrRanges.length; i++) {
//         if (isIPInCIDR(clientIP, cidrRanges[i])) {
//             isBlocked = true;
//             break;
//         }
//     }
// }
//
// // Handle blocked IP
if (isBlocked) {
    context.setVariable('response.status.code', '403');
    context.setVariable('response.header.Content-Type', 'application/json');
    context.setVariable('response.content', JSON.stringify({
        error: 'Access denied',
        message: 'Your IP address is blocked'
    }));
}
//
// // CIDR check function implementation
// function isIPInCIDR(ip, cidr) {
//     // Implementation as shown in previous example
// }