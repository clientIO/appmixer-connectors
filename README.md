![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/clientIO/appmixer-connectors?utm_source=oss&utm_medium=github&utm_campaign=clientIO%2Fappmixer-connectors&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# appmixer-connectors
Appmixer Connectors

## Examples
Examples can be found in the `src/examples` directory. They are not exhaustive, but they should give you an idea of how to use the connectors. Examples do not belong to our connector Marketplace, but they are useful for testing and development purposes.

## Test
In the `test` directory, you can find the test files for the connectors. They are not exhaustive as there is another set of tests that are not public.

### Running the tests
```sh
npm run test-unit
```

### Appmixer stub
In `test/utils.js` you can find a stub for the Appmixer API. It is supposed to emulate all the advanced features of the Appmixer engine like sending messages, doing HTTP requests, using cache, etc. It is not a complete implementation of the Appmixer API, but it is enough to test the connectors. You can use it to test your connectors without having to run the Appmixer engine.

These tests run for each PR. They are also integrated into SonarQube analysis which is run on each commit to `dev` branch.

### What to test
Rule of thumb:
- a `receive` function in a component should be tested if it has any logic in it (caching, timeouts, bulk processing). If it is just a pass-through, it does not need to be tested.
- a `routes.js` file should be tested if used for more complex tasks. For example processing incoming webhooks.
