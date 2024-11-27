# Imperva

## Notes on Imperva API rate limits
For v1 there doesn't seem to be any rate limiting message or status. The requests just don't go through.
Docs: https://docs.imperva.com/bundle/api-docs/page/api/api-overview-v1.htm

For v2, the rate limiting is done by the API itself. The result is a 429 status code with a message:
```json
{
	"res":3,
	"res_message":"Concurrent requests limit has been exceeded. Please re-send the request later",
	"debug_info": {
		"id-info": "999999"
	}
}
```

But the actual rate limit is not specified in the response. This error occured when requesting a single rule 1000 times in parallel. When the requests were reduced to 100, the error did not occur.

## SetBlockIPRule
This component is used to block an IP address for a specified time. The time is specified in the `ttl` field in seconds.

### Limitations
Maximum number of IP addresses that can be blocked in one run is 1000. This roughly translates 50 rules with 20 IP addresses each. Imperva allows for 20 IP addresses in a filter. Otherwise it throws: `Rule contains too many filters. Maximum of 20 filters is allowed`.

Another limitation is the maximum number of custom rules per site. The limit is 500 according to the Imperva API documentation. The component does check for this limit before creating a new rule.

### Configuration
The component allows the following configuration in the BackOffice:
- `blockIpMaxIpsPerRule` - Maximum number of IP addresses that can be blocked in one rule. Default is 20.
- `blockIpMaxIpsAllowed` - Maximum number of IP addresses that can be blocked in one run. Default is 1000.
- `blockIpMaxParallelRequests` - Maximum number of parallel requests to Imperva API. Default is 5.

## WAF Rule TTL
Some components (`SetRule`, `SetBlockIPRule`) allow for setting the TTL of a WAF rule. The TTL is the time in seconds that the rule will be active for.
After the TTL expires, the rule will be deleted by an Appmixer job (see jobs.js).
