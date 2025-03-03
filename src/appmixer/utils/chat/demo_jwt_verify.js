const jwt = require('jsonwebtoken');

// This is for illustrative purposes only.
// Never hardcode a private key in your code.
const publicKey = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAz0Mw00/Y/oZu+46dwL7J
yYwCDH0ZqEFzyHFvqA0GlV5iiToNQdXU/rmPgYQRsWuaVsVUBy+C0gxrjlmemxUG
hviws15FqqOeCBcOpVlbPxWF0bcGR34KAVmIwse9AG90J/ZCbWQ7LhAiS2c6GTNv
... truncated for brevity
-----END PUBLIC KEY-----`;
// const fs = require('fs');
// const publicKey = fs.readFileSync('my-public-key.pem', 'utf8');

const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjMsIm5hbWUiOiJKb2huIERvZSIsInNlc3Npb25faWQiOiJteXRlc3RzZXNzaW9uMSIsImlhdCI6MTczOTQ2MzM3MywiZXhwIjoxNzM5NDY2OTczfQ.ad1U3uSKtVJLxDw-SuFxX4kQiISsAyoFrPkwN5Mggri3XZnImCQFOU-P5xsTCAb-phcu2k3uRZakHzVs7Fr2fXmVUXcP_hOOA_2620YDoNDWhYRxiuB1LFb63sKDR3LGYrIDYYLxRTQViq3Pj7ar7s0pg9O94lo9amRJ6daRZYoJjP1unJPOKNtFZSO0d5FwXbV7626Y_ym6_YdAoBIJVRkLEurzfGhcRzYC06TtxwNnT4YAVyN6eng5RpIveJvTt3f8WgCu09_M8PnEil2PiFQjf3VHoaAqNf-ti6WwahCU6p7n_V7fOkCaHgCspT1DFr_BKoWcctSrsVow3XdVE0uiBCtk13Spyr9UItFNnx4jdNBeR5z-lotJGq7YcHXrHtAGuR2JGqLYQsA2nUqKRPYLj-00pFQiaVRgxV4lHqTM7GnVTHB4AXxj-k4mjaa3sWWONTqoPKIry43hyGVC-mdtUC0wcTp_JPryLS3OSCELSn7_Q13iKuWNru2WkrRm82X5Z8lUcoj1HFAm765rLUwSUK7nG46MKOh-t3gT3uNYYBQVVM5mcFCDJ5uIoMm9SRfwbixU9_Z4fnz7AfTZ_6VYAuy1KS6MD-iMG4jqF8lhQWGUtcTDpWuQHTPeb1F7OOqeOufL_JplAuHcpV34IKjBa0zd1svtv6uIpkjMv8E';

const decoded = jwt.verify(token, publicKey);
console.log(decoded);
