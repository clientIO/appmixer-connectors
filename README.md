![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/clientIO/appmixer-connectors?utm_source=oss&utm_medium=github&utm_campaign=clientIO%2Fappmixer-connectors&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# Appmixer Connectors

This repository contains the officially maintained connectors for Appmixer. They enable seamless integration with external services and help you build workflows faster by handling API access, authentication, and data flows.

## Key Benefits
- **Ease of use**: Pre-built connectors remove boilerplate for common integrations.
- **Flexibility**: Customize and extend connectors to suit specific needs.
- **Scalability**: Build workflows that scale with your workloads.

## Getting Started
To learn how to create custom connectors, refer to our comprehensive guide: [Creating Custom Connectors](https://docs.appmixer.com/getting-started/custom-connectors).

## AI Development

AI-assisted connector development lives in the public
**[appmixer-skills](https://github.com/Appmixer-ai/appmixer-skills)** repository:
agent skills that build, test, and review connectors end-to-end
(`build-connector`, `test-connector`, `review-connector`), installable as a
Claude Code plugin. Start there.

`.github/copilot-instructions.md` here is a **pointer to that repository**, not a
copy of it. The full guide used to be generated into this repo, but a 4000-line
duplicate of another repo's content is a copy that can go stale — and did, for
ten days, while the workflow meant to refresh it reported success. Rules now have
exactly one home: open a PR against appmixer-skills `instructions/`.

## Developing a connector — commit hooks

Connector development in this repo is gated by a **pre-commit hook** that
validates the files in your diff. One-time setup:

```sh
npm install -g appmixer    # the CLI runs the validators
                           # (until the next release ships `connector validate`,
                           #  use the experimental tag: npm install -g appmixer@dev)
npm run hooks:install      # git pre-commit -> validates your changes
```

From then on every commit checks your changed `bundle.json` / `component.json`
files (strict — new work must be clean; repo-wide legacy debt does not block
you), and CI runs the same gate on every PR into `dev`. Manual runs:
`npm run validate:changed` (your diff) or `npm run validate` (whole repo).

What the validators check is documented in the appmixer CLI — see the
[appmixer package on npm](https://www.npmjs.com/package/appmixer) or
`appmixer connector validate --help`.

## Contribution Guidelines
We welcome contributions from the community! To contribute:
1. Fork the repository.
2. Install the pre-commit hook (see *Developing a connector* above).
3. Create a new branch for your feature or bug fix.
4. Ensure your code adheres to our coding standards and includes tests.
5. Submit a pull request with a clear description of your changes.


## Examples
Examples can be found in the `src/examples` directory. They are not exhaustive, but they should give you an idea of how to use the connectors. Examples do not belong to our connector Marketplace, but they are useful for testing and development purposes.

## Test
In the `test` directory, you can find the test files for the connectors. They are not exhaustive as there is another set of tests that are not public.

### Running the Tests
```sh
# install dependencies once
scripts/npm-install.sh
# run the tests
npm run test-unit
```

### Appmixer Stub
In `test/utils.js` you can find a stub for the Appmixer API. It is supposed to emulate all the advanced features of the Appmixer engine like sending messages, doing HTTP requests, using cache, etc. It is not a complete implementation of the Appmixer API, but it is enough to test the connectors. You can use it to test your connectors without having to run the Appmixer engine.

These tests run on every PR. They also feed into SonarQube analysis, which runs on each commit to the `dev` branch.

### What to Test
Rule of thumb:
- A `receive` function in a component should be tested if it has any logic in it (caching, timeouts, bulk processing). If it is just a pass-through, it does not need to be tested.
- A `routes.js` file should be tested if used for more complex tasks, such as processing incoming webhooks.
