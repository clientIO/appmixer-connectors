# Daktela

## Generate module

```sh
appmixer init openapi ./daktela/openapi.yml ./daktela/
```

## Manual Updates

Apply the following manual updates since those are not covered by the OpenAPI generator.

### auth.js

Keep as is. Auth flow in Appmixer is as follows:

Connecting account:
- obtain username and password from the user
- obtain accessToken from the login endpoint

Using token in components:
- retrieve token from cache
- if not found, obtain it from the login endpoint and store it in cache

### `httpRequest()` methods
Keep retrieving accessToken from cache.

```js
// imports
const { getAccessTokenFromLoginEndpoint } = require('../../auth');

// httpRequest() method
const accessToken = await getAccessTokenFromLoginEndpoint(context);
```
