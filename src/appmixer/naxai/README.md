# Naxai

## Generate module

```sh
appmixer init openapi ./naxai/openapi.yml ./naxai/
```

## Manual Updates

Apply the following manual updates since those are not covered by the OpenAPI generator.

### All component.json files

```json
    "auth": {
        "service": "appmixer:naxai"
    },
```

### All httpRequest methods

Replace

```js
        const headers = {};
```

with

```js
        const headers = {
            'X-Client-Id': context.auth.clientId,
            'X-Client-Secret': context.auth.clientSecret
        };
```
