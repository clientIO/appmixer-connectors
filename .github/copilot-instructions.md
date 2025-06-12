# Code style
- Add one empty line after function definition.
- Use 4 spaces for indentation.

# Architecture
- Use `src/appmixer` for source code of components.
- Folder `src/examples` is only for examples and not real-world components.
- Use `test/` for tests.
- Use `test/utils.js` for Appmixer stub.

## Component
A component is a self-contained unit of functionality that can be used in Appmixer workflows. It can have multiple inPorts and outPorts, and it can be used to process data, trigger actions, or perform other tasks.
A component is defined by a `component.json` file and a "behavior" file with the same name as the component folder.
