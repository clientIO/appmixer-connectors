const jwt = require('jsonwebtoken');

// This is for illustrative purposes only.
// Never hardcode a private key in your code.
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIJQgIBADANBgkqhkiG9w0BAQEFAASCCSwwggkoAgEAAoICAQDPQzDTT9j+hm77
jp3AvsnJjAIMfRmoQXPIcW+oDQaVXmKJOg1B1dT+uY+BhBGxa5pWxVQHL4LSDGuO
WZ6bFQaG+LCzXkWqo54IFw6lWVs/FYXRtwZHfgoBWYjCx70Ab3Qn9kJtZDsuECJL
ZzoZM28XNHArRRvhH9kJLfYCuEMJ/9CEAGBNQSvPOw+KYfHx8qXnZhFu+kT/bE5a
l+jcxee8DFqW/3VZBbj2PWAzIEhuDfllF76+SR8P+sOfXIvnbIFkEVAyh38t+dJz
... truncated for brevity
-----END PRIVATE KEY-----`;
// const fs = require('fs');
// const privateKey = fs.readFileSync('my-private-key.pem', 'utf8');


const token = jwt.sign({
    user_id: 123,
    name: 'John Doe',
    // custom session ID - it can equal user_id to ensure each user has a unique session.
    // If present, it will be used as the session ID in the chat. Note that
    // the session_id in the JWT token (chat_token) has precedence over the session_id in the URL.
    session_id: 'mytestsession1'
}, privateKey, { algorithm: 'RS256', expiresIn: '1h' });

console.log(token);
