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

## WAF Rule TTL
`SetRule` component allows for setting the TTL of a WAF rule. The TTL is the time in seconds that the rule will be active for.
After the TTL expires, the rule will be deleted by an Appmixer job (see jobs.js).
