# JobFlow 🚀

Distributed Job Queue & Workflow Platform (BullMQ + Temporal Alternative)

JobFlow is a high-performance distributed task processing platform built to handle asynchronous workloads, retry policies, priority queues, and workers autoscaling. Users submit jobs, and worker nodes consume them from a distributed queue to process them independently.

## Project Phase: Milestone 1 Completed

In this initial phase (Phase 1), we initialized the core project layout and configured the backend with Node.js, Express, and TypeScript. We established clean architecture patterns including error handling, structured logging (Winston), environment validations, and implemented the health check and authentication endpoints.

---

## 🛠️ Tech Stack

### Phase 1 Core Tech Stack
* **Runtime:** Node.js (>= 18)
* **Framework:** Express.js (v4)
* **Language:** TypeScript
* **Logger:** Winston (structured logs / JSON formatter)
* **HTTP Log middleware:** Morgan
* **Security:** Helmet & CORS
* **Environment Configuration:** dotenv

### Planned Future Stack
* **Queue System:** BullMQ (powered by Redis)
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Deployment:** Docker & Kubernetes
* **Monitoring:** Prometheus & Grafana
* **CI/CD:** GitHub Actions

---

## 📂 Project Directory Structure

```text
jobflow/
├── backend/
│   ├── src/
│   │   ├── config/          # Global application configurations & logger setup
│   │   ├── constants/       # Global application constant values & definitions
│   │   ├── controllers/     # Request/response controller route handlers
│   │   ├── middlewares/     # Express route middlewares (e.g. error handlers, auth verification)
│   │   ├── routes/          # Express application routing routes mapping
│   │   ├── services/        # Business logic services (e.g. AuthService)
│   │   ├── types/           # Core TypeScript type/interfaces declarations
│   │   ├── utils/           # Utility helpers and custom error classes
│   │   ├── app.ts           # Configured Express application configuration
│   │   └── server.ts        # Production HTTP listener entrypoint & graceful shutdown scripts
│   ├── .env.example         # Template environment variables
│   ├── .env                 # Active environment configuration parameters
│   ├── .gitignore           # Git ignore patterns for the backend package
│   ├── package.json         # Dependencies & scripts manager
│   ├── tsconfig.json        # TypeScript compiler configurations
│   └── README.md            # Backend instructions
├── frontend/                # React dashboard application (Upcoming)
├── docs/                    # Architecture diagrams & guides
├── docker/                  # Dockerfiles & docker-compose manifests
├── .github/
│   └── workflows/           # CI/CD action pipelines
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

---

## 🛣️ API Documentation (Milestone 1 Endpoints)

| Method | Endpoint | Description | Headers |
|:---|:---|:---|:---|
| **GET** | `/` | Welcomes user & shows status OK | - |
| **GET** | `/health` | Kubernetes-ready system status & uptime | - |
| **POST** | `/api/v1/auth/register` (also `/register`) | Register a new user | Content-Type: application/json |
| **POST** | `/api/v1/auth/login` (also `/login`) | Authenticate user & return JWT | Content-Type: application/json |

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

---

## 🌟 Future Roadmap

- **Phase 2 — Database Integration:** Integrate Prisma with PostgreSQL database for persistent storage.
- **Phase 3 — Queue System Setup:** Integrate BullMQ and Redis backend. Add first workers to handle asynchronous jobs (Email, Image resize).
- **Phase 4 — Dashboards & Live Monitoring:** Build a React admin dashboard. Add WebSocket/Socket.io event integrations.
- **Phase 5 — Metrics & Kubernetes Orchestration:** Setup Prometheus metrics exporter and containerize via Docker/K8s.
