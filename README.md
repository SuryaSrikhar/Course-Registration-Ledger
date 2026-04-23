# Course Registration Ledger (Remix Deployment)

This is a full-stack blockchain-based course registration system with no Hardhat dependency.

It provides:
- no over-enrollment through smart contract seat checks,
- immutable and transparent course activity,
- secure add/drop flows.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS + Framer Motion
- Backend: Node.js + Express + ethers.js
- Smart Contract: Solidity deployed manually from Remix IDE
- Wallet: MetaMask

## Clean Structure

- contracts/
- backend/
- frontend/

## Where To Paste Contract Address And ABI

### Backend

1. Paste contract address:
- backend/config.js
- Update MANUAL_CONTRACT_ADDRESS (or set CONTRACT_ADDRESS in .env)

2. Paste full ABI JSON array:
- backend/contract-abi.json

### Frontend

1. Paste contract address:
- frontend/src/config/contractConfig.js
- Update CONTRACT_ADDRESS

2. Paste full ABI JSON array:
- frontend/src/config/contractConfig.js
- Update CONTRACT_ABI

Frontend automatically uses MetaMask transaction mode when this file is configured.

## Environment

Use .env in root:

RPC_URL=http://127.0.0.1:8545
SERVER_PRIVATE_KEY=0xYOUR_TEST_PRIVATE_KEY_FOR_WRITE_APIS
CONTRACT_ADDRESS=0xYOUR_REMIX_DEPLOYED_CONTRACT_ADDRESS
COURSE_IDS=CSE101,CSE102
PORT=4000
CORS_ORIGIN=http://localhost:5173

Notes:
- SERVER_PRIVATE_KEY is used by backend write APIs.
- COURSE_IDS is optional and only needed if your contract does not emit CourseCreated events.

## Run

1. Install dependencies:

npm install

2. Start backend:

node backend/server.js

3. Start frontend:

cd frontend
npm start

Open http://localhost:5173

## Backend APIs

- GET /courses
- POST /create-course
  - body: { "courseId": "CSE101", "capacity": 60 }
- POST /enroll
  - body: { "courseId": "CSE101" }
- POST /drop
  - body: { "courseId": "CSE101" }

## How It Works (Review Summary)

1. Contract is deployed manually in Remix.
2. You paste ABI and contract address into backend/frontend config files.
3. Backend reads live course state from blockchain and exposes REST APIs.
4. Frontend shows a premium animated dashboard with real-time polling.
5. Wallet connection is done through window.ethereum (MetaMask).
6. Enroll, drop, and create-course operations submit blockchain transactions.
7. Revert reasons such as Course full or Already enrolled are surfaced as user-friendly notifications.
