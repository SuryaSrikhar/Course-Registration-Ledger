# Course Registration Ledger

This project implements a decentralized, tamper-resistant course registration ledger using:

- Frontend: Streamlit web app
- Backend: Python service layer
- Blockchain ledger: Solidity smart contract on Hardhat local network
- Smart contract logic: enrollment, withdrawal, capacity, eligibility, approvals

## Features Implemented

- Immutable on-chain ledger entries for student registration, course creation, enrollment, withdrawal, approval updates, eligibility updates, and seat-capacity updates.
- Smart contract enforcement for:
  - seat capacity checks
  - add/drop operations
  - student eligibility validation
  - approval-gated course enrollment
- Student + course unique identifiers (`studentUid`, `courseUid`) converted to deterministic keys to avoid conflicting entries.
- Admin/registrar oversight model for capacity changes and approvals.
- Automated tests for over-enrollment prevention and workflow correctness.

## Requirement Coverage

1. Transparent blockchain ledger for registration, withdrawal, and seat updates:
   - `ledger` array + `LedgerRecorded` event in contract.
2. Smart contract management for checks and validations:
   - `enroll`, `withdrawFromCourse`, `updateCourseCapacity`, `setStudentEligibility`, `approveStudentForCourse`.
3. Registration workflow with student actions and admin oversight:
   - students enroll/withdraw; owner/registrars create courses, set approvals/capacities.
4. Over-enrollment prevention:
   - `require(courses[courseKey].enrolled < courses[courseKey].capacity, "Course full")`.
5. Unique identifiers for student and course consistency:
   - `studentUid` and `courseUid` hashed to keys; duplicates blocked.
6. Consensus algorithm selection and justification:
   - see [docs/consensus.md](docs/consensus.md).

## Consensus Algorithm Choice (Campus Permissioned Network)

For a university consortium network (Registrar Office + department admins + IT governance nodes), a **Proof of Authority / IBFT-style permissioned consensus** is recommended because:

- known validators are suitable for an institutionally controlled environment;
- high throughput and low finality latency fit peak registration windows;
- no mining overhead and lower operational cost;
- Byzantine fault tolerance protects integrity if a minority of validator nodes misbehave;
- governance model can rotate validator rights across approved campus authorities.

## Project Structure

- `contracts/CourseRegistrationLedger.sol`: core smart contract logic
- `backend/contract_client.py`: Python backend client for contract interaction
- `backend/ledger_cli.py`: optional CLI for student/admin workflow operations
- `frontend/app.py`: Streamlit frontend
- `test/CourseRegistrationLedger.test.js`: automated test suite
- `scripts/deploy.js`: deployment script
- `hardhat.config.js`: Hardhat config
- `docs/consensus.md`: detailed consensus rationale
- `requirements.txt`: Python dependencies

## Install

```bash
npm install
pip install -r requirements.txt
```

## Compile

```bash
npm run compile
```

## Test

```bash
npm test
```

## Deploy (local)

```bash
npm run node
npm run deploy -- --network localhost
```

## Run Web Frontend (Streamlit)

```bash
streamlit run frontend/app.py
```

In the app sidebar:

1. Set RPC URL (default `http://127.0.0.1:8545`)
2. Paste deployed contract address
3. Paste private key (for write operations)
4. Click Connect

## Optional CLI Usage (Python Backend)

Use one Hardhat account private key for write calls.

Read status:

```bash
python backend/ledger_cli.py --contract-address <DEPLOYED_ADDRESS> status --course-uid CSE-501
```

Register student:

```bash
python backend/ledger_cli.py --contract-address <DEPLOYED_ADDRESS> --private-key <PRIVATE_KEY> register-student --uid STU-001 --wallet <WALLET_ADDRESS> --eligible true
```

Create course:

```bash
python backend/ledger_cli.py --contract-address <DEPLOYED_ADDRESS> --private-key <PRIVATE_KEY> create-course --uid CSE-501 --title "Blockchain Fundamentals" --capacity 2 --approval-required false
```

Enroll / Withdraw:

```bash
python backend/ledger_cli.py --contract-address <DEPLOYED_ADDRESS> --private-key <PRIVATE_KEY> enroll --course-uid CSE-501 --student-uid STU-001
python backend/ledger_cli.py --contract-address <DEPLOYED_ADDRESS> --private-key <PRIVATE_KEY> withdraw --course-uid CSE-501 --student-uid STU-001
```
