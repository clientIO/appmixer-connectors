var clientIP = context.getVariable('request.header.X-Forwarded-For') || context.getVariable('request.ip');

if (clientIP && clientIP.indexOf(',') > -1) {
    clientIP = clientIP.split(',')[0].trim();
}

print("Proxy value: " + context.getVariable("keyValueEntries"));
print("Proxy value: " + context.getVariable("1.1.1.1"));
print("Proxy value: " + context.getVariable("blocked-ips"));


// Get blocked IPs from KVM
var blockedIPsEntry = context.getVariable('private.appmixer-blocked-ips');
var blockedIPs = [];

var kvmName = 'appmixer-blocked-ips';
// print("Proxy value: " + context.getVariable("enviroment." + kvmName + ".keyValueEntries"));
print("Proxy value: " + context.getVariable(kvmName + ".1.1.1.1"));
print("Proxy value: " + context.getVariable(kvmName + ".blocked-ips"));
// print("xx: " + context.getVariable("organization." + kvmName + ".keyValueEntries"));
// print("xx: " + context.getVariable("private." + kvmName + ".keyValueEntries"));
// print("xx: " + context.getVariable(kvmName + ".keyValueEntries"));
// print("xx: " + context.getVariable(kvmName + ".1.1.1.2"));


print('kv: ' + blockedIPsEntry);
try {
    blockedIPs = JSON.parse(blockedIPsEntry || '[]');
    print('blocked IPs: ' + JSON.stringify(blockedIPs));
} catch (e) {
    print('Error parsing blocked IPs: ' + e);
    blockedIPs = [];
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