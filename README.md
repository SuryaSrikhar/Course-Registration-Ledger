# Course Registration Ledger (Ganache + Hardhat Auto Deployment)

This project is a full-stack blockchain Course Registration Ledger with automated deployment setup.

Manual copy-paste of contract address and ABI is removed.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS + Framer Motion
- Backend: Node.js + Express + ethers.js
- Smart Contract Deployment: Hardhat -> Ganache
- Wallet: MetaMask

## Updated Structure

- contracts/CourseRegistrationLedger.sol
- hardhat.config.js
- scripts/deploy.js
- backend/server.js
- backend/config.js
- backend/contract-address.txt (auto-generated)
- backend/contract-abi.json (auto-generated/updated)
- frontend/src/App.jsx
- frontend/src/services/api.js

## Automated Flow

1. Start Ganache at http://127.0.0.1:7545
2. Run deploy script with Hardhat
3. Deploy script writes:
   - backend/contract-address.txt
   - backend/contract-abi.json
4. Backend auto-reads both files at startup
5. Frontend fetches contract config from backend (/contract-config)
6. App runs without any manual ABI/address edits

## Environment

Create .env in root (use .env.example):

RPC_URL=http://127.0.0.1:7545
DEPLOYER_PRIVATE_KEY=0xYOUR_GANACHE_PRIVATE_KEY_OPTIONAL
SERVER_PRIVATE_KEY=0xYOUR_GANACHE_PRIVATE_KEY_FOR_BACKEND_WRITES
COURSE_IDS=CSE101,CSE102
PORT=4000
CORS_ORIGIN=http://localhost:5173

Notes:
- DEPLOYER_PRIVATE_KEY is optional if Ganache unlocked accounts are available.
- SERVER_PRIVATE_KEY is required for backend write APIs (/create-course, /enroll, /drop).
- COURSE_IDS is optional fallback if your contract emits no CourseCreated events.

## Run Instructions

1. Install dependencies

npm install

2. Start Ganache

- Use Ganache UI or CLI
- Ensure RPC is running at http://127.0.0.1:7545

3. Deploy contract (auto-generates ABI + address files)

npm run deploy

4. Start backend

npm run server

5. Start frontend

npm run frontend

6. Open app

http://localhost:5173

## Backend APIs

- GET /health
- GET /contract-config
- GET /courses
- POST /create-course
- POST /enroll
- POST /drop

## Error Handling Notes

- If Ganache is not running, deployment fails with network connection error.
- If contract artifact files are missing, backend startup fails with a clear message to run npm run deploy.
- deploy.js ensures output paths exist before writing files.
- Contract name used in deployment is CourseRegistrationLedger and matches contracts/CourseRegistrationLedger.sol.

## Cleanup Notes

- Removed old manual frontend contract config file: frontend/src/config/contractConfig.js
- No Python backend files were found in this repository.
