# Daktela

## Generate module

```sh
appmixer init openapi ./daktela/openapi.yml ./daktela/
```

## Manual Updates

Apply the following manual updates since those are not covered by the OpenAPI generator.

### auth.js
Keep as is. Auth flow is `pwd`.

### `httpRequest()` methods
Keep retrieving from context.

```js
query.append('accessToken', context.auth.token);
```
