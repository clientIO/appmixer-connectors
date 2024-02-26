# OpenAI

## Generate connector

```
appmixer init openapi --artifacts --patch ./openai/openapi.json-patch ./openai/openapi.yaml ./openai/
```

## Manual Updates

Apply the following manual updates since those are not covered by the OpenAPI generator.

### core/createChatCompletion/createChatCompletion.js

Map synthetic fields to the `messages` array.

Replace

```
        const inputMapping = {
            'model': input['model'],
            'functions': input['functions'],
            'function_call': input['function_call'],
            'temperature': input['temperature'],
            'top_p': input['top_p'],
            'n': input['n'],
            'stream': input['stream'],
            'stop': input['stop'],
            'max_tokens': input['max_tokens'],
            'presence_penalty': input['presence_penalty'],
            'frequency_penalty': input['frequency_penalty'],
            'user': input['user'],
            'prompt_role': input['prompt_role'],
            'prompt_content': input['prompt_content'],
            'prompt_name': input['prompt_name'],
        };
```

with:

```
        const inputMapping = {
            'model': input['model'],
            'functions': input['functions'],
            'function_call': input['function_call'],
            'temperature': input['temperature'],
            'top_p': input['top_p'],
            'n': input['n'],
            'stream': input['stream'],
            'stop': input['stop'],
            'max_tokens': input['max_tokens'],
            'presence_penalty': input['presence_penalty'],
            'frequency_penalty': input['frequency_penalty'],
            'user': input['user'],
            'messages': [{
                role: input['prompt_role'],
                content: input['prompt_content'],
                name: input['prompt_name']
            }]
        };
```

### auth.js

Update the authentiction module to display the apiKey securely.

Replace

```
        requestProfileInfo(context) {
            return {
                name: this.replaceVariables(context, '{apiKey}')
            };
        },
```

with:

```
        requestProfileInfo(context) {
            const apiKey = this.replaceVariables(context, '{apiKey}');
            return {
                name: apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4)
            };
        },
```
