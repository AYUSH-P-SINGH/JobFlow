# JobFlow 🚀

Distributed Job Queue & Workflow Platform (BullMQ + Temporal Alternative)

JobFlow is a high-performance distributed task processing platform built to handle asynchronous workloads, retry policies, priority queues, and workers autoscaling. Users submit jobs, and worker nodes consume them from a distributed queue to process them independently.

## Project Phase: Phase 2 — Authentication Module Completed

In Phase 2, we implemented a complete in-memory authentication module. We migrated the codebase to a clean modular architecture separating logic into reusable `common` layers and business-focused `modules`. Key features include password hashing via `bcryptjs`, access and refresh JWT tokens, token rotation support, Zod-based request validation, Winston logger integration for security logs, and a comprehensive integration test suite using Node's native test runner.

---

## 🛠️ Tech Stack

### Phase 2 Core Tech Stack
* **Runtime:** Node.js (v26.3.0)
* **Framework:** Express.js (v4)
* **Language:** TypeScript
* **Logger:** Winston (structured logs / JSON formatter)
* **HTTP Log middleware:** Morgan
* **Security:** Helmet & CORS
* **Environment Configuration:** dotenv
* **Validation Library:** Zod
* **Authentication:** JWT (jsonwebtoken) & bcryptjs
* **Testing:** Native Node.js Test Runner & Supertest

### Planned Future Stack
* **Queue System:** BullMQ (powered by Redis)
* **Database:** PostgreSQL
* **ORM:** Prisma (Phase 3 Integration)
* **Deployment:** Docker & Kubernetes
* **Monitoring:** Prometheus & Grafana
* **CI/CD:** GitHub Actions

---

## 📂 Project Directory Structure

```text
jobflow/
├── backend/
│   ├── src/
│   │   ├── config/          # Global environment configurations
│   │   ├── common/          # Shared layout across multiple modules
│   │   │   ├── errors/      # Standard operational HTTP errors
│   │   │   ├── logger/      # Winston configuration
│   │   │   ├── middleware/  # Express middlewares (auth, error, validation, notFound)
│   │   │   └── utils/       # Utility helpers (e.g. jwt token helpers)
│   │   ├── modules/         # Business domain modules
│   │   │   └── auth/        # Self-contained authentication feature module
│   │   │       ├── auth.controller.ts   # Controllers for auth endpoints
│   │   │       ├── auth.routes.ts       # Route endpoints definition
│   │   │       ├── auth.service.ts      # Core auth business logic
│   │   │       ├── auth.repository.ts   # In-memory repository (user storage & refresh tokens)
│   │   │       ├── auth.types.ts        # Auth-specific types & user interfaces
│   │   │       ├── auth.validation.ts   # Zod request schemas
│   │   │       └── auth.test.ts         # Test suite for auth endpoints
│   │   ├── app.ts           # Configured Express application instance
│   │   └── server.ts        # HTTP listener entrypoint & graceful shutdown scripts
│   ├── .env.example         # Template environment variables
│   ├── .env                 # Active environment configuration parameters
│   ├── .gitignore           # Git ignore patterns for backend
│   ├── package.json         # Dependencies & scripts manager
│   ├── tsconfig.json        # TypeScript compiler configurations
│   └── README.md            # Backend instructions
├── frontend/                # React dashboard application (Upcoming)
├── docs/                    # Architecture diagrams & guides
├── docker/                  # Dockerfiles & docker-compose manifests
├── LICENSE                  # License agreement file (MIT)
└── README.md                # This global documentation file
```

---

## 🚀 How to Run the App Locally

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18 or higher recommended).

### Installation

1. Clone or navigate to the repository workspace:
   ```bash
   cd JOBFLOW
   ```

2. Go to the `backend` folder:
   ```bash
   cd backend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development Mode
Start the development server with live reload enabled using `ts-node-dev`:
```bash
npm run dev
```

### Building for Production
Compile the TypeScript code to Javascript inside `dist/`:
```bash
npm run build
```

### Running in Production Mode
Start the compiled Javascript bundle:
```bash
npm run start
```

### Running the Test Suite
Run the suite of integration and unit tests using Node's native test runner:
```bash
npm run test
```

---

## 🛣️ API Documentation (Phase 2 Endpoints)

Every API success response follows the standard format:
```json
{
  "success": true,
  "data": {}
}
```
And error responses follow:
```json
{
  "success": false,
  "message": "Error details here"
}
```

| Method | Endpoint | Description | Headers | Request Body |
|:---|:---|:---|:---|:---|
| **GET** | `/` | Welcomes user & shows status OK | - | - |
| **GET** | `/health` | Kubernetes-ready system status & uptime | - | - |
| **POST** | `/api/v1/auth/register` | Register a new user | Content-Type: application/json | `{"email": "...", "password": "..."}` |
| **POST** | `/api/v1/auth/login` | Authenticate user & return JWT access + refresh tokens | Content-Type: application/json | `{"email": "...", "password": "..."}` |
| **POST** | `/api/v1/auth/refresh` | Rotate and issue a new set of tokens | Content-Type: application/json | `{"refreshToken": "..."}` |
| **GET** | `/api/v1/auth/me` | Fetch user profile payload of the current session | Authorization: Bearer `<accessToken>` | - |

### Testing with Curl / API Clients

#### Register
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"mypassword123"}'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"mypassword123"}'
```

#### Get Current Profile
```bash
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

#### Refresh Access Token
```bash
curl -X POST http://localhost:5000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

---

## 🌟 Future Roadmap

- **Phase 3 — Database Integration:** Integrate Prisma with PostgreSQL database for persistent storage, replacing the current in-memory repositories.
- **Phase 4 — Queue System Setup:** Integrate BullMQ and Redis backend. Add first workers to handle asynchronous jobs (Email, Image resize).
- **Phase 5 — Dashboards & Live Monitoring:** Build a React admin dashboard. Add WebSocket/Socket.io event integrations.
- **Phase 6 — Metrics & Kubernetes Orchestration:** Setup Prometheus metrics exporter and containerize via Docker/K8s.
