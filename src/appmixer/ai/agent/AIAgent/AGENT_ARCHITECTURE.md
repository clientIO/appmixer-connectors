# AI Agent Architecture

This document describes the architecture of the AI Agent v2+ component(s) in Appmixer.


## Memory

### Types of agentic memory

#### Short-term memory

Short-term memory (STM) enables an AI agent to remember recent inputs for immediate decision-making.

STM is typically implemented using a rolling buffer or a context window, which holds a limited amount of recent data before being overwritten. While this approach improves continuity in short interactions, it does not retain information beyond the session, making it unsuitable for long-term personalization or learning.

#### Long-term memory

Long-term memory (LTM) allows AI agents to store and recall information across different sessions, making them more personalized and intelligent over time.

Unlike short-term memory, LTM is designed for permanent storage, often implemented using databases, knowledge graphs or vector embeddings.

One of the most effective techniques for implementing LTM is retrieval augmented generation (RAG), where the agent fetches relevant information from a stored knowledge base to enhance its responses.

##### Episodic memory

Episodic memory allows AI agents to recall specific past experiences, similar to how humans remember individual events. This type of memory is useful for case-based reasoning, where an AI learns from past events to make better decisions in the future.

Episodic memory is often implemented by logging key events, actions and their outcomes in a structured format that the agent can access when making decisions.

##### Semantic memory

Semantic memory is responsible for storing structured factual knowledge that an AI agent can retrieve and use for reasoning. Unlike episodic memory, which deals with specific events, semantic memory contains generalized information such as facts, definitions and rules.

AI agents typically implement semantic memory using knowledge bases, symbolic AI or vector embeddings, allowing them to process and retrieve relevant information efficiently. This type of memory is used in real-world applications that require domain expertise, such as legal AI assistants, medical diagnostic tools and enterprise knowledge management systems.

##### Procedural memory

Procedural memory in AI agents refers to the ability to store and recall skills, rules and learned behaviors that enable an agent to perform tasks automatically without explicit reasoning each time.

It is inspired by human procedural memory, which allows people to perform actions such as riding a bike or typing without consciously thinking about each step. In AI, procedural memory helps agents improve efficiency by automating complex sequences of actions based on prior experiences.

### Memory Architecture in Appmixer

#### Short-term memory

Runtime memory = platform-controlled memory

Built-in default memory using Appmixer Data Stores (no configuration required, works out-of-the-box). If special memory requirements needed, a "memory" port allows plugging custom memory components.

1. Before agent loop
    - memory.loadContext({ prompt: '', threadId: '', userId: '' }) => { workingMemory: '', facts: [], episodes: [], procedures: [] }
2. After inference
    - saveTurn({ threadId: '', userId: '', userMessage: '', assistantMessage: '', toolCalls: [] })    

The memory component decides whether to:

* append messages
* update summary
* create embeddings
* extract memories

#### Long-term memory

Memory-as-tool = model-controlled memory

Added as tools where needed. Typically, the tools should expose the following functionality:

- searchMemory()
- rememberMemory()
- forgetMemory()

## Human-in-the-loop (HITL)

## Tools

## MCP Servers


## Knowledgebase

Appmixer platform needs to provide a vector search mechanism for indexing and quering custom knowledbases. This needs to run both in the AWS cloud and in air-gapped environments (self-hosted).

### Recomended Architecture

Hugging Face Text Embeddings Inference. Use Text Embeddings Inference (TEI) as a Dockerized local service. It is designed specifically for serving embedding models, supports batching, exposes an API, and can run fully offline with model weights mounted into the container. Hugging Face documents TEI as a deployment toolkit for open-source embedding models and explicitly supports air-gapped deployment by pre-downloading model weights and mounting them locally.
See https://huggingface.co/docs/text-embeddings-inference/en/index for details.

Embedding model: nomic-ai/nomic-embed-text-v1.5 or BAAI/bge-small-en-v1.5
Runtime: Hugging Face Text Embeddings Inference
Packaging: Docker image + preloaded model directory
API: internal /embed endpoint
Storage: MongoDB DocumentDB-compatible vector collection if available, or MongoDB vector search where supported

Model metadata should be stored with every vector:

{
  text,
  embedding,
  doc: "org/sdlc-policy.pdf",
  embeddingModel: "nomic-ai/nomic-embed-text-v1.5",
  embeddingDim: 768,
  embeddingVersion: "2026-06",
  chunkingVersion: "v1"
}

This is important because changing the embedding model later means old vectors are usually incompatible and must be re-indexed.

Then, indexing worker chunks documents, calls the embedding service in batches, and stores vectors in MongoDB.

#### Pipeline

...

### Embedding Model Selection

For a quick, in-process PoC, use e.g. Xenova/paraphrase-MiniLM-L3-v2 model. It only takes around 200MB memory and is super fast.
For production deployments, consider Qwen3-Embedding-0.6B, it's much better quality, multilingual, heavier, more production-grade retrieval model. Note: we might need Qwen3-Embedding-0.6B-ONNX version. My tests
with HuggingFace transformers runner took about 2GB memory.
Also, check https://huggingface.co/spaces/mteb/leaderboard for more models.

### Supported file types

- PDF (.pdf -> unpdf -> text -> .md)
- PowerPoint
- Word (docx, Mammoth.js -> .html -> turndown -> .md -> Markdownlint -> optimized .md)
- Excel
- Images (exif data and OCR - https://github.com/kaelzhang/penteract-ocr)
- HTML (.html -> turndown -> .md -> Markdownlint -> optimized .md)
- Text-based formats (CSV, JSON, XML)
- ZIP files (iterates over contents)
- ePub (https://github.com/uxiew/epub2MD)

## MongoDB as vector search

### Create a vector index

Definition:

```
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "knowledgebaseId"
    },
    {
      "type": "filter",
      "path": "docId"
    },
    {
      "type": "filter",
      "path": "doc"
    },
    {
      "type": "filter",
      "path": "embeddingModel"
    },
    {
      "type": "filter",
      "path": "embeddingVersion"
    },
    {
      "type": "filter",
      "path": "chunkingVersion"
    },
    {
      "type": "filter",
      "path": "chunkIndex"
    }
  ]
}
```

## Necessary platform updates

### Conditional sections in auth dialog

Currently, the auth dialog does not support conditional sections. This is problematic because in AI Agent component, there's a lot of
configurations that are provider specific. I want to be able to define precondition for a field so that it is only displayed if a value of another field equals a certain value.
(similar to what we have(had) in inspector: e.g. { when: { eq: provider: 'amazon-bedrock' } }).

### 'Hook' ports at the bottom

Currently, we only have input and ouput ports in components. I want to introduce a new type (currently called) "hook" ports that will display at the bottom of the component (or on the right with vertical layout).
I'm not sure if we need a new type internally or if these ports should be inside the current "outPorts" (TBD). These ports will be used in the flow to extend functionality of the main component.
For example, in AIAgent, I want to have a "tool" hook port where the user can connect another action component to be used as a tool for the AIAgent. Connected components to the hook port will not show
output ports since the user can't chain more components. Another example is the "mcp" hook port (the use can just connect an MCP server to the hook but can't chain on the of the MCP server).

### Output ports can whitelist possible connections

Currently, any component can be connected to any other output port. However, I need a way for UI to only allow certain whitelisted components that can be connected. This applies to both
the "+" button on output ports showing a UI of actions that I can connect but also connecting via drag&drop (in case of incompatible components, link connections from an output port to an incompatible component should
not be made possible).

For example, AIAgent component has a "mcp" output port. In this case, the user can connect only MCP servers to this port. Connecting any other action component would not make sense and would not work as expected.

I propose a new otion for outPorts in the component manifest "whitelist" that will allow to define a list of tags that the UI will match with "tags" field of other components. In case of our AIAgent component,
the outPorts can look like:

```
outPorts: [
    ...
    { name: "mcp", whitelist: ["mcpServer"] }
    ...
]
```

And MCP server component will have in their manifest:

tags: ["mcpServer"]

Note that this, therefore, introduces a new "tags" section for any component in the manifest as well.

### Model defined parameter

Tools connected to AIAgent component need to let the user decide which fields are to be infered by AI. In my current PoC, I use a dummy output variable on my "tool" output port of AIAgent
called "Model Defined Parameter" that I can add to a field which I want AI to infer. However, this is not user friendly. Rather, I'd like the Inspector UI to introduce a new button for each
field that I can toggle to mark the field as AI infered. This flag needs to then be stored in the flowDescriptor for the AIAgent component to be able to detect.


### Loggging of static calls

Currently, components called in static mode don't produce logs. However, in case of AIAgent component, which calls connected tools statically, we don't see the tool calls in the logs.
Solution: introduce a new option when calling components in static mode `{ ..., "log": true, ... }` that will instruct the engine to log these calls.


### JSON viewer in Data Stores [nice to have]

I'd like the Data Stores UI to show a JSON viewer for data store values that are JSON parsable.