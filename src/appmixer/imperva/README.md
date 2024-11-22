# Imperva

## WAF Rule TTL
`SetRule` component allows for setting the TTL of a WAF rule. The TTL is the time in seconds that the rule will be active for.
After the TTL expires, the rule will be deleted by an Appmixer job (see jobs.js).
