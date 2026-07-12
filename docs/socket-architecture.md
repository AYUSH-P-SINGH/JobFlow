# Socket.IO Gateway Architecture

JobFlow utilizes a real-time event-streaming gateway built on top of [Socket.IO](https://socket.io/) to propagate workflow progress, job executions, alerts, and metrics to connected clients.

---

## 1. Gateway Server Initialization

The gateway is initialized inside `src/socket/socket.server.ts` and attached directly to the Express HTTP Server.

```text
    +-----------------------------------------------+
    |             Express HTTP Server               |
    +-----------------------+-----------------------+
                            │
                            ▼
    +-----------------------+-----------------------+
    |             Socket.IO Server                  |
    +-----------------------+-----------------------+
                            │
                            ▼
    +-----------------------+-----------------------+
    |           CORS / Connection Config            |
    |  - origin: '*'                                |
    |  - methods: ['GET', 'POST']                   |
    +-----------------------+-----------------------+
                            │
                            ▼
    +-----------------------+-----------------------+
    |         JWT Authentication Handshake          |
    |  - Decodes Token                             |
    |  - Attaches User info to Socket               |
    +-----------------------+-----------------------+
                            │
                            ▼
    +-----------------------+-----------------------+
    |           Connection Event Listener            |
    |  - Join default rooms (User, Role)            |
    |  - Join custom rooms (Workflow tracker)       |
    |  - Register replay handlers                   |
    +-----------------------------------------------+
```

---

## 2. Security and Connection Lifecycle

### JWT Authentication Middleware (`socket.middleware.ts`)
Before any WebSocket connection is finalized, the server intercepts the handshake and validates the JWT payload sent in the `auth.token` block:
- Decodes the token using the secret signature key (`JWT_SECRET`).
- Verifies expiration.
- Rejects connections failing validation with `Authentication error: Token invalid or expired`.
- On success, binds the user object to the socket session (`socket.user`).

---

## 3. Room-Based Isolation Model (`socket.rooms.ts`)

Instead of broadcasting execution events to all connected clients, JobFlow isolates traffic into secure rooms:

| Room Pattern | Audience / Description |
|:---|:---|
| **`room:user:<userId>`** | Multi-device user room. Receives private notifications, updates on workflows they launched, or alerts. |
| **`room:workflow:<workflowId>`** | Workflow-specific detail room. Receives granular steps and job execution progress logs (e.g. `job.progress`, `job.started`) for that workflow. |
| **`room:admins`** | System operator room. Receives cluster-wide metrics, active worker details, and system execution statistics. Only accessible to users with the `ADMIN` role. |

---

## 4. Reconnection & State Recovery

If a client disconnects due to network degradation:
1. The client establishes a new connection handshake.
2. The client re-sends room join requests (e.g., `join:workflow` for the active page view).
3. The server catches the room join event and triggers the `replayEvents` gateway method.
4. **Replay Engine**: Fetches the recent 20 cached events for that specific workflow from an in-memory ring buffer (cached inside `SocketGateway`) and streams them back to the client immediately. This restores the timeline UI to a synchronized state without page reloading.
