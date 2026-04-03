import json
from pathlib import Path
from typing import Any, Dict, Optional

from web3 import Web3


class CourseLedgerClient:
    def __init__(self, rpc_url: str, contract_address: str, private_key: Optional[str] = None):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError(f"Could not connect to RPC: {rpc_url}")

        self.contract_address = Web3.to_checksum_address(contract_address)
        self.private_key = private_key

        if self.w3.eth.get_code(self.contract_address) in (b"", b"\x00"):
            raise RuntimeError(
                "No contract code found at that address. Make sure the contract was deployed to the same network and that the address is complete."
            )

        artifact_path = Path(__file__).resolve().parents[1] / "artifacts" / "contracts" / "CourseRegistrationLedger.sol" / "CourseRegistrationLedger.json"
        if not artifact_path.exists():
            raise RuntimeError("Contract artifact not found. Run 'npm run compile' first.")

        with artifact_path.open("r", encoding="utf-8") as f:
            artifact = json.load(f)

        self.contract = self.w3.eth.contract(address=self.contract_address, abi=artifact["abi"])

    def owner(self) -> str:
        return self.contract.functions.owner().call()

    def ledger_count(self) -> int:
        return int(self.contract.functions.ledgerCount().call())

    def get_course_snapshot(self, course_uid: str) -> Dict[str, Any]:
        cap, enrolled, seats_remaining, approval_required = self.contract.functions.getCourseSnapshot(course_uid).call()
        return {
            "capacity": int(cap),
            "enrolled": int(enrolled),
            "seatsRemaining": int(seats_remaining),
            "approvalRequired": bool(approval_required),
        }

    def get_student(self, student_uid: str) -> Dict[str, Any]:
        wallet, eligible, exists = self.contract.functions.getStudent(student_uid).call()
        return {
            "wallet": wallet,
            "eligible": bool(eligible),
            "exists": bool(exists),
        }

    def get_course(self, course_uid: str) -> Dict[str, Any]:
        title, capacity, enrolled, approval_required, exists = self.contract.functions.getCourse(course_uid).call()
        return {
            "title": title,
            "capacity": int(capacity),
            "enrolled": int(enrolled),
            "approvalRequired": bool(approval_required),
            "exists": bool(exists),
        }

    def is_enrolled(self, course_uid: str, student_uid: str) -> bool:
        return bool(self.contract.functions.isEnrolled(course_uid, student_uid).call())

    def _send_tx(self, fn_call) -> str:
        if not self.private_key:
            raise RuntimeError("Private key is required for write transactions.")

        account = self.w3.eth.account.from_key(self.private_key)
        nonce = self.w3.eth.get_transaction_count(account.address)

        tx = fn_call.build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "chainId": self.w3.eth.chain_id,
                "gasPrice": self.w3.eth.gas_price,
            }
        )

        if "gas" not in tx:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 1.2)

        signed = account.sign_transaction(tx)
        raw_transaction = getattr(signed, "raw_transaction", None)
        if raw_transaction is None:
            raw_transaction = signed.rawTransaction

        tx_hash = self.w3.eth.send_raw_transaction(raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status != 1:
            raise RuntimeError(f"Transaction failed: {tx_hash.hex()}")

        return tx_hash.hex()

    def register_student(self, student_uid: str, wallet: str, eligible: bool) -> str:
        wallet = Web3.to_checksum_address(wallet)
        return self._send_tx(self.contract.functions.registerStudent(student_uid, wallet, eligible))

    def set_student_eligibility(self, student_uid: str, eligible: bool) -> str:
        return self._send_tx(self.contract.functions.setStudentEligibility(student_uid, eligible))

    def create_course(self, course_uid: str, title: str, capacity: int, approval_required: bool) -> str:
        return self._send_tx(self.contract.functions.createCourse(course_uid, title, int(capacity), approval_required))

    def update_course_capacity(self, course_uid: str, new_capacity: int) -> str:
        return self._send_tx(self.contract.functions.updateCourseCapacity(course_uid, int(new_capacity)))

    def set_course_approval_required(self, course_uid: str, approval_required: bool) -> str:
        return self._send_tx(self.contract.functions.setCourseApprovalRequired(course_uid, approval_required))

    def approve_student_for_course(self, course_uid: str, student_uid: str, approved: bool) -> str:
        return self._send_tx(self.contract.functions.approveStudentForCourse(course_uid, student_uid, approved))

    def enroll(self, course_uid: str, student_uid: str) -> str:
        return self._send_tx(self.contract.functions.enroll(course_uid, student_uid))

    def withdraw(self, course_uid: str, student_uid: str) -> str:
        return self._send_tx(self.contract.functions.withdrawFromCourse(course_uid, student_uid))
