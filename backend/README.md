# DR Healthcare Backend

Welcome to the backend repository of the **DR Healthcare** application. This backend serves as the core engine powering the DR Healthcare platform. Developed using modern Python frameworks, it provides secure, high-performance REST APIs designed specifically for managing clinical workflows, doctor prescriptions, hospital clinical reports, and patient healthcare records.

The system is built on top of **FastAPI** for rapid, async-capable API serving and utilizes **MongoDB Atlas** as a highly scalable NoSQL database. 

---

## Backend Features

The DR Healthcare backend offers a comprehensive suite of features:

- **Authentication**: Secure registration and login workflows using bcrypt password hashing.
- **Email OTP Verification**: Integrated SMTP-based One-Time Password verification for new accounts.
- **JWT Authentication**: Stateless session management using secure JSON Web Tokens.
- **Role-Based Access Control**: Strict access boundaries protecting resources for Patients, Doctors, and Hospitals.
- **Patient APIs**: Secure endpoints for retrieving dynamic dashboards, analytical history, and predictions.
- **Doctor APIs**: Prescriptive clinical tools for creating and cataloging patient prescriptions.
- **Hospital APIs**: Robust mechanisms to upload and catalog clinical reports.
- **Shared APIs**: Unified search APIs allowing authorized medical professionals to look up patients.
- **MongoDB Atlas Integration**: Cloud-based NoSQL collections storing dynamic medical objects.
- **SMTP Email Service**: Dedicated background service for delivering authentication and alert emails.
- **GridFS Storage**: File chunking and storage implementation designed to handle diagnostic images and PDFs securely within MongoDB.
- **Health Monitoring Endpoint**: Diagnostic API to verify database and environment connectivity.
- **Railway Deployment Support**: Out-of-the-box configuration for seamless continuous deployment to Railway.
- **Proper Logging**: Integrated logging tracking lifecycle events and unhandled exceptions.
- **Error Handling**: Advanced exception interception mapping Python errors to standardized HTTP 4xx and 5xx responses.
- **Validation**: Strict schema validation using Pydantic models.

---

## Technology Stack

The backend leverages the following technologies:

- **Python**: Core programming language.
- **FastAPI**: High-performance asynchronous web framework.
- **MongoDB Atlas**: Fully managed cloud NoSQL database.
- **PyMongo**: Python driver for MongoDB interaction.
- **JWT (JSON Web Tokens)**: Cryptographically signed tokens for secure authorization.
- **Pydantic**: Data validation and settings management.
- **SMTP (Gmail)**: Standardized protocol used for delivering automated emails.
- **GridFS**: MongoDB specification for storing and retrieving large files.
- **Railway**: Cloud platform configured for production deployment.
- **Uvicorn**: Lightning-fast ASGI server execution environment.
- **python-dotenv**: Environment variable management.
- **bcrypt**: Industry-standard cryptographic password hashing.

---

## Project Structure

```text
backend/
├── .env.example
├── README.md
├── requirements.txt
├── railway.toml
├── main.py
├── database.py
├── config.py
├── auth.py
├── dependencies.py
├── email_service.py
├── storage.py
├── models.py
└── routers/
    ├── hospital.py
    ├── doctor.py
    ├── patient.py
    └── shared.py
```

---

## API Endpoints

### Authentication

- `GET /`: Root diagnostic endpoint ensuring the backend is awake.
- `GET /health`: System health monitor reporting DB connection and ENV validity.
- `POST /send-otp`: Generates and emails a 6-digit OTP to the user.
- `POST /verify-otp`: Validates the provided OTP against the database record.
- `POST /resend-otp`: Invalidates the previous OTP and issues a new one.
- `POST /signup`: Registers a new user, hashes the password, and confirms verification.
- `POST /login`: Authenticates user credentials and issues a JWT access token.
- `GET /profile`: Validates the Bearer token and returns the authenticated user's demographics.

### Hospital APIs

- `POST /api/hospital/reports/upload`: Accepts `multipart/form-data` uploads (clinical PDFs or images) and secures them via GridFS linked to a `patient_id`.
- `GET /api/hospital/reports`: Retrieves a list of all clinical reports uploaded by the authenticated hospital.

### Doctor APIs

- `POST /api/doctor/prescriptions`: Allows an authenticated doctor to generate and store a new clinical prescription for a specific patient.

### Patient APIs

- `GET /api/patient/dashboard`: Compiles high-level analytics and recent predictions for the patient dashboard.
- `GET /api/patient/history`: Retrieves the chronological timeline of clinical reports and assessments.
- `GET /api/patient/predictions/{prediction_id}`: Fetches a specific AI-driven diagnostic prediction detailing findings and recommendations.

### Shared APIs

- `GET /api/patients/search`: Allows authorized personnel (Doctors/Hospitals) to search for patients via username or mobile number.
- `GET /api/patients/{patient_id}`: Retrieves detailed public demographics of a specified patient for clinical evaluation.

---

## Authentication Flow

The application enforces a rigorous, multi-step authentication process:

1. **OTP**: Users initiate registration by supplying an email. The backend issues a 6-digit OTP via SMTP.
2. **Signup**: Once the OTP is verified, the registration payload is authorized, the password is encrypted using `bcrypt`, and the user is saved.
3. **Login**: Returning users exchange their email and password for a cryptographic token.
4. **JWT**: A stateless JSON Web Token is minted using the `SECRET_KEY` and returned to the client.
5. **Protected Routes**: Every clinical API extracts the `Authorization: Bearer <token>` header, decoding it to resolve the user's identity.
6. **Role-Based Authorization**: Specific endpoints explicitly verify the user's assigned role (e.g., verifying a user is a doctor before allowing prescription creation).

---

## MongoDB Collections

The system relies on dynamically structured collections inside MongoDB Atlas:

- `users`: Core identity collection storing hashed passwords and protected demographics.
- `otp_verification`: Temporary ledger tracking active verification codes and their 5-minute expiry windows.
- `reports`: Catalog of metadata linking uploaded clinical documents to patients and hospitals.
- `prescriptions`: Ledger of all medical instructions issued by doctors.
- `predictions`: Analytical diagnostics generated by the core evaluation engine.
- **GridFS (`fs.files` & `fs.chunks`)**: Binary storage partitions containing actual PDF/Image payloads.

---

## Security Features

The backend architecture is secured natively against common attack vectors:

- **Password Hashing**: `bcrypt` ensures plain-text passwords are never exposed or stored.
- **JWT**: Cryptographic signatures prevent token tampering and session hijacking.
- **OTP Verification**: Eliminates automated spam registrations and validates email ownership.
- **Role-Based Authorization**: Enforces strict horizontal access control boundaries across user types.
- **Input Validation**: Pydantic models automatically sanitize and validate incoming JSON payloads, preventing NoSQL injections.
- **Environment Variables**: Total abstraction of secrets (DB URIs, SMTP credentials) via `.env` injection.

---

## Error Handling

A global exception interception layer ensures stability and predictable responses:

- **HTTP Status Codes**: Native mapping of operational outcomes (e.g., `401 Unauthorized`, `404 Not Found`, `503 Service Unavailable`).
- **Validation**: Malformed payloads are rejected immediately with a highly descriptive `422 Unprocessable Entity` outlining the exact missing fields.
- **Logging**: Utilizing the native `logging` library to track runtime transactions and execution tracing.
- **Exception Handling**: Unhandled runtime crashes are caught by a global middleware, returning a standardized JSON error without exposing stack traces to the client.

---

## Configuration

The backend relies on the following required environment variables to operate. **Never commit your `.env` file to version control.**

```text
MONGODB_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net"
DATABASE_NAME="dr_healthcare"
SECRET_KEY="<your-secure-cryptographic-key>"
EMAIL_ADDRESS="your-smtp-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
ACCESS_TOKEN_EXPIRE_MINUTES="1440"
```

---

## Installation

To configure and run the backend locally on your machine, follow these steps:

1. **Clone the repository**
   ```bash
   git clone <repository_url>
   cd backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install requirements**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure `.env`**
   Copy `.env.example` to `.env` and populate the fields with your actual secrets.
   ```bash
   cp .env.example .env
   ```

---

## Running Locally

To execute the backend development server locally, utilize Uvicorn:

```bash
uvicorn main:app --reload
```
The server will boot and become accessible at `http://127.0.0.1:8000`.

---

## API Documentation

FastAPI automatically generates interactive API documentation. Once the server is running locally, you can view the schemas and test endpoints via:

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## Deployment

The backend has been securely and successfully deployed to **Railway** for production operation.

- **Connected GitHub Repository**: Railway listens to the `main` branch, triggering isolated container builds upon every push.
- **Configured Environment Variables**: All `.env` secrets have been securely injected into the Railway project dashboard.
- **Connected MongoDB Atlas**: Traffic is routed seamlessly from the Railway execution environment to the remote MongoDB Atlas cluster.
- **Configured SMTP Email Service**: The container utilizes the injected `EMAIL_PASSWORD` to authenticate securely via Google SMTP.
- **Configured public Railway domain**: The API is bound to a static, public `https` URL acting as the permanent connection gateway for the frontend application.
- **Production-ready deployment**: Powered dynamically by `railway.toml`, ensuring the `uvicorn` instance binds accurately to the assigned `$PORT`.

---

## Backend Responsibilities

The backend acts as the secure master orchestrator for the system. Its specific responsibilities include:

- **Authentication**: Overseeing secure account creation and session negotiation.
- **Database Management**: Handling direct read/write operations efficiently against MongoDB.
- **OTP Verification**: Mitigating fake user generation via real-time email verification.
- **Email Service**: Running background SMTP deliveries without blocking UI interaction.
- **JWT Management**: Encrypting, issuing, and validating cryptographic session tokens.
- **Role-Based Authorization**: Denying unauthorized actions (e.g., stopping Patients from accessing Hospital tools).
- **Clinical Report Handling**: Managing high-bandwidth binary uploads securely via GridFS.
- **Prescription Management**: Architecting and linking doctor-issued guidelines to specific users.
- **Patient Data APIs**: Compiling unified statistical views for frontend dashboards.

---

## Future Improvements

While the application is fully robust and production-ready, optional architectural improvements for scalability could include:

- **Refresh Tokens**: To provide seamless, infinite session continuity.
- **Docker**: Containerization using `Dockerfile` and `docker-compose` for absolute local parity.
- **CI/CD**: Implementation of GitHub Actions for automated unit testing before deployment.
- **Redis Caching**: Introducing an in-memory datastore for lightning-fast OTP verifications and dashboard analytics retrieval.
- **AWS S3**: Migrating binary report file storage away from GridFS to standard cloud buckets.
- **Rate Limiting**: Defending the `send-otp` endpoints against automated DDoS requests.
- **Monitoring**: Integration with Sentry for granular error tracking in production.

---

## Author

**[Zainab Ejaz]**  
*Final Year Project — DR Healthcare*
