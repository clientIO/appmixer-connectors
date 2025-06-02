### Tests
```sh
# Test the appmixer CLI
appmixer test auth login

# SendPrompt OK
cd SendPrompt
appmixer t c -i '{"in": {"model":"claude-3-5-haiku-latest","prompt":"Say random city name. Only name!","max_tokens": 10}}'
appmixer t c -i '{"in": {"model":"claude-3-7-sonnet-latest","prompt":"Why ocean is salty?","max_tokens": 10}}'
appmixer t c -i '{"in": {"model":"claude-3-5-haiku-latest","prompt":"Suggest WoW character, output race, class and name","max_tokens": 100}}'

# TransformTextToJSON
cd ../TransformTextToJSON
appmixer t c -i '{"in": {"model":"claude-3-5-haiku-latest","max_tokens":100,"text":"I am John Doe, born in 1984-01-11. I have a son named James Doe, born in 2020-05-05. Today is 2025-04-29T08:22:22.121Z", "jsonSchema": "{\"type\":\"object\",\"properties\":{\"contacts\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"},\"age\":{\"type\":\"number\"}}}}}}"}}'
```
