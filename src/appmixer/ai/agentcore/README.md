# Amazon Bedrock AgentCore Connector

Integrate Appmixer flows with [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html) — AWS's managed platform for deploying, running, and extending AI agents at scale.

AgentCore has two functional areas covered by this connector:

- **Agent Runtimes** — containerised or code-based agents you deploy and invoke over a session-oriented HTTP API.
- **Memory** — a managed long-term memory store that persists events (conversation turns), extracts structured memory records, and supports semantic retrieval.

---

## Authentication

The connector uses **AWS SigV4** signing via the official AWS SDK v3. You will need a set of IAM credentials (or temporary STS credentials) with the permissions described in the [IAM Permissions](#iam-permissions) section below.

| Field | Required | Description |
|---|---|---|
| **AWS Access Key ID** | ✅ | IAM user or role access key. |
| **AWS Secret Access Key** | ✅ | Corresponding secret key. |
| **AWS Region** | ✅ | Region where your AgentCore resources live (e.g. `us-east-1`). |
| **AWS Session Token** | Optional | Required only when using temporary STS/assumed-role credentials. |

Connection validation calls `ListAgentRuntimes` (a lightweight control-plane read) to verify the credentials and region are correct before saving the account.

---

## IAM Permissions

Create an IAM policy and attach it to the IAM user or role whose credentials you supply to Appmixer. The tables below list the **minimum required permissions** per component.

### Authentication / Connection Validation

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:ListAgentRuntimes` | `*` |

---

### Agent Runtime Components

#### Create Agent Runtime

| Permission | Resource | Notes |
|---|---|---|
| `bedrock-agentcore-control:CreateAgentRuntime` | `*` | Core permission. |
| `iam:PassRole` | The IAM role ARN you pass as **Role ARN** | Required so AgentCore can assume the execution role. |

**Container image mode — additional permissions on the execution role (the Role ARN you pass):**

| Permission | Resource | Notes |
|---|---|---|
| `ecr:GetDownloadUrlForLayer` | The ECR repository | AgentCore pulls the container image from ECR. |
| `ecr:BatchGetImage` | The ECR repository | |
| `ecr:GetAuthorizationToken` | `*` | |

**Code (S3) mode — additional permissions on the execution role (the Role ARN you pass):**

| Permission | Resource | Notes |
|---|---|---|
| `s3:GetObject` | `arn:aws:s3:::<bucket>/<prefix>` | AgentCore downloads the code archive from S3. |
| `s3:GetObjectVersion` | `arn:aws:s3:::<bucket>/<prefix>` | Required when you specify a **Code S3 Version ID**. |
| `s3:ListBucket` | `arn:aws:s3:::<bucket>` | Needed for AgentCore to enumerate the object. |
| `s3:GetBucketLocation` | `arn:aws:s3:::<bucket>` | Required for cross-region bucket validation. |

> **Note:** The S3 and ECR permissions above are granted to the **execution role** (the IAM role passed as *Role ARN*), **not** to the Appmixer IAM user. The Appmixer IAM user only needs `bedrock-agentcore-control:CreateAgentRuntime` and `iam:PassRole`.

#### Get Agent Runtime

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:GetAgentRuntime` | `*` |

#### Delete Agent Runtime

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:DeleteAgentRuntime` | `*` |

#### List Agent Runtimes

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:ListAgentRuntimes` | `*` |

#### List Agent Runtime Endpoints

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:ListAgentRuntimeEndpoints` | `*` |

#### Invoke Agent Runtime

| Permission | Resource | Notes |
|---|---|---|
| `bedrock-agentcore:InvokeAgentRuntime` | `*` | Required for all invocations. |
| `bedrock-agentcore:InvokeAgentRuntimeForUser` | `*` | Required only when **Runtime User ID** is provided. |

#### Stop Runtime Session

| Permission | Resource |
|---|---|
| `bedrock-agentcore:StopRuntimeSession` | `*` |

---

### Memory Components

#### Create Memory

| Permission | Resource | Notes |
|---|---|---|
| `bedrock-agentcore-control:CreateMemory` | `*` | Core permission. |
| `iam:PassRole` | The IAM role ARN you pass as **Memory Execution Role ARN** | Required only when you supply an optional execution role. |
| `kms:CreateGrant`, `kms:DescribeKey` | The KMS key ARN | Required only when you supply a custom **Encryption Key ARN**. |

#### List Memories

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:ListMemories` | `*` |

#### Delete Memory

| Permission | Resource |
|---|---|
| `bedrock-agentcore-control:DeleteMemory` | `*` |

#### Create Event

| Permission | Resource |
|---|---|
| `bedrock-agentcore:CreateEvent` | `*` |

#### List Events

| Permission | Resource |
|---|---|
| `bedrock-agentcore:ListEvents` | `*` |

#### List Sessions

| Permission | Resource |
|---|---|
| `bedrock-agentcore:ListSessions` | `*` |

#### Find Memory Records (Semantic Search)

| Permission | Resource |
|---|---|
| `bedrock-agentcore:RetrieveMemoryRecords` | `*` |

#### List Memory Records

| Permission | Resource |
|---|---|
| `bedrock-agentcore:ListMemoryRecords` | `*` |

#### Get Memory Record

| Permission | Resource |
|---|---|
| `bedrock-agentcore:GetMemoryRecord` | `*` |

#### Delete Memory Record

| Permission | Resource |
|---|---|
| `bedrock-agentcore:DeleteMemoryRecord` | `*` |

---

### Generic / Utility

#### Make API Call

`MakeApiCall` signs every request with SigV4 under the `bedrock-agentcore` service name and forwards it to whichever data-plane or control-plane endpoint you specify. The required IAM permissions depend entirely on the API action you invoke. Add the corresponding `bedrock-agentcore:*` or `bedrock-agentcore-control:*` action to your policy for each API you call through this component.

---

### Trigger Components

#### New Memory Session / New Memory Event

These triggers poll the data-plane `ListSessions` and `ListEvents` APIs respectively.

| Trigger | Permission Required |
|---|---|
| New Memory Session | `bedrock-agentcore:ListSessions` |
| New Memory Event | `bedrock-agentcore:ListEvents` |

---

### Minimal IAM Policy Example (full access to all components)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AgentCoreControlPlane",
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore-control:CreateAgentRuntime",
        "bedrock-agentcore-control:GetAgentRuntime",
        "bedrock-agentcore-control:DeleteAgentRuntime",
        "bedrock-agentcore-control:ListAgentRuntimes",
        "bedrock-agentcore-control:ListAgentRuntimeEndpoints",
        "bedrock-agentcore-control:CreateMemory",
        "bedrock-agentcore-control:ListMemories",
        "bedrock-agentcore-control:DeleteMemory"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AgentCoreDataPlane",
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:InvokeAgentRuntime",
        "bedrock-agentcore:InvokeAgentRuntimeForUser",
        "bedrock-agentcore:StopRuntimeSession",
        "bedrock-agentcore:CreateEvent",
        "bedrock-agentcore:ListEvents",
        "bedrock-agentcore:ListSessions",
        "bedrock-agentcore:RetrieveMemoryRecords",
        "bedrock-agentcore:ListMemoryRecords",
        "bedrock-agentcore:GetMemoryRecord",
        "bedrock-agentcore:DeleteMemoryRecord"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassExecutionRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::<account-id>:role/<execution-role-name>"
    }
  ]
}
```

Replace `<account-id>` and `<execution-role-name>` with your actual values, or use `*` for the `PassRole` resource if you manage multiple execution roles.

---

## Components

### Agent Runtime

#### Create Agent Runtime

Creates a new AgentCore Runtime — a managed, session-oriented environment that runs your agent code.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Name | ✅ | Runtime name. Must start with a letter; letters, numbers and underscores only (max 48 chars). |
| Role ARN | ✅ | IAM role the runtime assumes at execution time. |
| Artifact Type | — | `Container image (ECR)` *(default)* or `Code (S3)`. |
| **Container mode** | | |
| Container Image URI | ✅* | ECR URI of the agent container image, e.g. `123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest`. |
| **Code (S3) mode** | | |
| Code S3 Bucket | ✅* | S3 bucket containing the source code archive. |
| Code S3 Prefix | ✅* | S3 object key (path) of the archive, e.g. `agents/my-agent.zip`. |
| Code S3 Version ID | Optional | Specific S3 object version. Omit to use the latest. |
| Managed Runtime | ✅* | Runtime environment: `Python 3.13`, `Python 3.12`, `Python 3.11`, or `Node.js 22`. |
| Code Entry Point | ✅* | Entry-point file(s), e.g. `main.py`. Comma-separated list allowed. |
| **Common optional fields** | | |
| Network Mode | — | `PUBLIC` *(default)* or `VPC`. |
| Server Protocol | — | `MCP` or `HTTP`. |
| Description | — | Human-readable description. |
| Environment Variables | — | JSON object of environment variables injected into the runtime. |

*\* Required only for the selected artifact type.*

**Outputs**

| Field | Description |
|---|---|
| `agentRuntimeId` | Unique ID of the created runtime. |
| `agentRuntimeArn` | Full ARN. |
| `agentRuntimeVersion` | Initial version identifier. |
| `status` | Provisioning status (`CREATING`, `ACTIVE`, …). |
| `createdAt` | ISO-8601 creation timestamp. |

---

#### Get Agent Runtime

Retrieves the full details of a single AgentCore Runtime.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Agent Runtime ID | ✅ | The runtime's unique identifier. |
| Agent Runtime Version | Optional | Specific version to retrieve. Omit for the latest. |

**Outputs:** `agentRuntimeId`, `agentRuntimeArn`, `agentRuntimeName`, `agentRuntimeVersion`, `description`, `roleArn`, `status`, `createdAt`, `lastUpdatedAt`.

---

#### Delete Agent Runtime

Permanently deletes an AgentCore Runtime. This action is irreversible.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Agent Runtime ID | ✅ | ID of the runtime to delete. |

---

#### List Agent Runtimes

Lists all AgentCore Runtimes in the account and region.

**Inputs**

| Field | Description |
|---|---|
| Output Type | How results are emitted: as a complete list, one item at a time, or only the first item. |

**Output:** Array of runtime summary objects.

---

#### List Agent Runtime Endpoints

Lists all endpoints (versions) registered for a specific AgentCore Runtime.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Agent Runtime ID | ✅ | ID of the runtime whose endpoints to list. |
| Output Type | — | Same options as List Agent Runtimes. |

**Output:** Array of endpoint summary objects.

---

#### Invoke Agent Runtime

Sends a request to an AgentCore Runtime and returns the buffered (non-streaming) response.

The agent's streamed response is concatenated into a single string. If the response is valid JSON it is also parsed and emitted as `responseJson`.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Agent Runtime ARN | ✅ | ARN (or agent ID) of the runtime to invoke. |
| Runtime Session ID | ✅ | Session ID for maintaining conversation state (33–256 chars). |
| Payload | ✅ | Request body sent to the agent, e.g. `{"prompt": "Hello"}`. |
| Qualifier (Endpoint) | Optional | Named endpoint pointing to a specific version. Defaults to `DEFAULT`. |
| Runtime User ID | Optional | User identifier forwarded to the agent. Requires the `bedrock-agentcore:InvokeAgentRuntimeForUser` IAM permission. |
| Content Type | Optional | MIME type of the payload. Defaults to `application/json`. |
| Accept | Optional | Desired MIME type of the response. Defaults to `application/json`. |

**Outputs**

| Field | Description |
|---|---|
| `response` | Raw response text from the agent. |
| `responseJson` | Parsed JSON response (when the agent returns valid JSON). |
| `runtimeSessionId` | Session ID echoed back by the runtime. |
| `contentType` | MIME type of the response. |
| `statusCode` | HTTP status code of the agent response. |

---

#### Stop Runtime Session

Terminates an active session in an AgentCore Runtime, freeing any stateful resources held by that session.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Agent Runtime ARN | ✅ | ARN of the runtime that owns the session. |
| Runtime Session ID | ✅ | ID of the session to stop (33–256 chars). |
| Qualifier (Endpoint) | Optional | Named endpoint. Defaults to `DEFAULT`. |

---

### Memory

AgentCore Memory lets you persist conversation events, automatically extract long-term facts and preferences, and semantically retrieve them on demand.

#### Create Memory

Creates a new Memory resource. Optionally waits for it to reach the `ACTIVE` state before continuing (up to ~3 minutes).

**Inputs**

| Field | Required | Description |
|---|---|---|
| Name | ✅ | Unique memory name (letters, numbers, underscores). |
| Event Expiry Duration (days) | ✅ | Days before memory events are automatically expired (3–365). |
| Description | Optional | Human-readable description. |
| Memory Execution Role ARN | Optional | IAM role granting the memory access to AWS services (e.g. Bedrock models for extraction). |
| Encryption Key ARN | Optional | KMS key ARN for encrypting stored data at rest. |
| Extraction Strategy | Optional | Built-in strategy that automatically extracts structured memory records from events (`SEMANTIC_MEMORY`, `USER_PREFERENCE`, `SUMMARY`). |
| Strategy Name | Optional | Name for the extraction strategy (required when a strategy type is selected). |
| Strategy Namespaces | Optional | Comma-separated namespace templates the strategy writes into, e.g. `/facts/{actorId}`. |
| Wait Until Active | — | When enabled, the component polls until the memory reaches `ACTIVE` before emitting output. |

**Outputs:** `id`, `arn`, `name`, `description`, `status`, `eventExpiryDuration`, `createdAt`.

---

#### List Memories

Lists all Memory resources in the account and region.

**Inputs:** Output Type.

---

#### Delete Memory

Permanently deletes a Memory resource **and all of its events and records**. This action is irreversible.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | ID of the memory to delete. |

---

#### Create Event

Writes a memory event (a conversation turn) into a Memory resource. Events are the raw input that memory extraction strategies process to produce structured records.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Target Memory resource. |
| Actor ID | ✅ | Identifier of the actor (user or agent) creating the event. |
| Session ID | Optional | Session this event belongs to. Omit to have AgentCore assign one. |
| Role | Optional | Author role for a conversational event (`USER` or `ASSISTANT`). Used when **Message Text** is provided. |
| Message Text | Optional | Plaintext conversational message to store. Ignored when **Payload** is set. |
| Payload (raw JSON) | Optional | Raw payload as a JSON array of `PayloadType` objects. Overrides **Message Text** when provided. |
| Event Timestamp | Optional | ISO-8601 timestamp. Defaults to the current time. |

**Outputs:** `eventId`, `memoryId`, `actorId`, `sessionId`, `eventTimestamp`.

---

#### List Events

Returns all events for a specific actor session within a Memory resource.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource to query. |
| Actor ID | ✅ | Filter events to this actor. |
| Session ID | ✅ | Filter events to this session. |
| Include Payloads | Optional | When enabled, the full event payload is included in each result. |
| Output Type | — | Result emission mode. |

---

#### List Sessions

Returns all sessions for a specific actor within a Memory resource.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource to query. |
| Actor ID | ✅ | Actor whose sessions to list. |
| Output Type | — | Result emission mode. |

---

#### Find Memory Records (Semantic Search)

Semantically searches a Memory resource using the `RetrieveMemoryRecords` API. Returns the most relevant memory records for the given natural-language query.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource to search. |
| Namespace | ✅ | Namespace prefix to scope the search, e.g. `/users/user-123`. |
| Search Query | ✅ | Natural-language query for semantic retrieval. |
| Top K | Optional | Maximum number of records to return. |
| Memory Strategy ID | Optional | Scope the search to a specific extraction strategy. |
| Output Type | — | Result emission mode. |

---

#### List Memory Records

Lists memory records stored in a Memory resource by namespace (non-semantic, full listing).

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource to query. |
| Namespace | ✅ | Namespace prefix to filter by, e.g. `/users/user-123`. |
| Memory Strategy ID | Optional | Filter by strategy. |
| Output Type | — | Result emission mode. |

---

#### Get Memory Record

Retrieves a single memory record by its ID.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource containing the record. |
| Memory Record ID | ✅ | ID of the specific record to retrieve. |

**Outputs:** `memoryRecordId`, `memoryStrategyId`, `content`, `namespaces`, `createdAt`.

---

#### Delete Memory Record

Permanently deletes a single memory record.

**Inputs**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource containing the record. |
| Memory Record ID | ✅ | ID of the record to delete. |

---

### Utility

#### Make API Call

Generic SigV4-signed HTTP client for the AgentCore data-plane and control-plane APIs. Use this component to call any AgentCore endpoint not covered by the dedicated components, or to access newer API features before they are wrapped.

Relative paths (e.g. `/runtimes/`) are automatically resolved against the data-plane base URL `https://bedrock-agentcore.<region>.amazonaws.com`. Full URLs (data-plane or control-plane) are used as-is.

All requests are signed with the `bedrock-agentcore` SigV4 service name, which is the correct signing name for both planes.

**Inputs**

| Field | Required | Description |
|---|---|---|
| API Endpoint URL | ✅ | Full URL or relative path. |
| HTTP Method | ✅ | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. |
| Query Parameters | Optional | Key-value pairs appended to the URL. |
| Request Body | Optional | JSON object or string body. |
| Request Headers | Optional | Additional headers (e.g. custom `Content-Type`). |

**Outputs:** `status` (HTTP status code), `headers`, `body` (parsed response).

---

### Triggers

Triggers use **polling** — AgentCore does not provide native webhooks. Each trigger runs on a configurable schedule and emits an event only for items that are new since the last poll.

#### New Memory Session

Fires whenever a new session appears for the configured actor in a Memory resource.

**Configuration**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource to watch. |
| Actor ID | ✅ | Actor whose sessions to monitor. |

**Required IAM permission:** `bedrock-agentcore:ListSessions`

**Outputs:** `sessionId`, `actorId`, `createdAt`.

---

#### New Memory Event

Fires whenever a new event is written to the configured actor session in a Memory resource.

**Configuration**

| Field | Required | Description |
|---|---|---|
| Memory ID | ✅ | Memory resource to watch. |
| Actor ID | ✅ | Actor to monitor. |
| Session ID | ✅ | Session to monitor. |

**Required IAM permission:** `bedrock-agentcore:ListEvents`

**Outputs:** `eventId`, `actorId`, `sessionId`, `memoryId`, `eventTimestamp`, `payload`.

---

## Related AWS Documentation

- [Amazon Bedrock AgentCore overview](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html)
- [AgentCore Runtime API reference](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_Operations_Amazon_Bedrock_AgentCore.html)
- [AgentCore Memory concepts](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore-memory.html)
- [IAM actions for Amazon Bedrock AgentCore](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonbedrockagentcore.html)
