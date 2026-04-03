import argparse
import json
from typing import Optional

from contract_client import CourseLedgerClient


def parse_bool(value: str) -> bool:
    v = value.strip().lower()
    if v in {"true", "1", "yes", "y"}:
        return True
    if v in {"false", "0", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError("Expected true/false")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Course Registration Ledger CLI")
    parser.add_argument("--rpc-url", default="http://127.0.0.1:8545", help="Blockchain RPC URL")
    parser.add_argument("--contract-address", required=True, help="Deployed contract address")
    parser.add_argument("--private-key", default=None, help="Private key for write transactions")

    sub = parser.add_subparsers(dest="command", required=True)

    p_status = sub.add_parser("status", help="Show owner, ledger count and optional course snapshot")
    p_status.add_argument("--course-uid", default=None)

    p_register = sub.add_parser("register-student", help="Register student")
    p_register.add_argument("--uid", required=True)
    p_register.add_argument("--wallet", required=True)
    p_register.add_argument("--eligible", required=True, type=parse_bool)

    p_set_elig = sub.add_parser("set-eligibility", help="Set student eligibility")
    p_set_elig.add_argument("--uid", required=True)
    p_set_elig.add_argument("--eligible", required=True, type=parse_bool)

    p_create = sub.add_parser("create-course", help="Create course")
    p_create.add_argument("--uid", required=True)
    p_create.add_argument("--title", required=True)
    p_create.add_argument("--capacity", required=True, type=int)
    p_create.add_argument("--approval-required", required=True, type=parse_bool)

    p_update_cap = sub.add_parser("update-capacity", help="Update course capacity")
    p_update_cap.add_argument("--uid", required=True)
    p_update_cap.add_argument("--capacity", required=True, type=int)

    p_set_rule = sub.add_parser("set-approval-rule", help="Set course approval required")
    p_set_rule.add_argument("--uid", required=True)
    p_set_rule.add_argument("--approval-required", required=True, type=parse_bool)

    p_approve = sub.add_parser("approve", help="Approve or unapprove student for a course")
    p_approve.add_argument("--course-uid", required=True)
    p_approve.add_argument("--student-uid", required=True)
    p_approve.add_argument("--approved", required=True, type=parse_bool)

    p_enroll = sub.add_parser("enroll", help="Enroll student in course")
    p_enroll.add_argument("--course-uid", required=True)
    p_enroll.add_argument("--student-uid", required=True)

    p_withdraw = sub.add_parser("withdraw", help="Withdraw student from course")
    p_withdraw.add_argument("--course-uid", required=True)
    p_withdraw.add_argument("--student-uid", required=True)

    return parser


def require_private_key(private_key: Optional[str]) -> str:
    if not private_key:
        raise RuntimeError("--private-key is required for this command")
    return private_key


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    client = CourseLedgerClient(
        rpc_url=args.rpc_url,
        contract_address=args.contract_address,
        private_key=args.private_key,
    )

    if args.command == "status":
        payload = {
            "owner": client.owner(),
            "ledgerCount": client.ledger_count(),
        }
        if args.course_uid:
            payload["courseSnapshot"] = client.get_course_snapshot(args.course_uid)
        print(json.dumps(payload, indent=2))
        return

    require_private_key(args.private_key)

    if args.command == "register-student":
        tx = client.register_student(args.uid, args.wallet, args.eligible)
    elif args.command == "set-eligibility":
        tx = client.set_student_eligibility(args.uid, args.eligible)
    elif args.command == "create-course":
        tx = client.create_course(args.uid, args.title, args.capacity, args.approval_required)
    elif args.command == "update-capacity":
        tx = client.update_course_capacity(args.uid, args.capacity)
    elif args.command == "set-approval-rule":
        tx = client.set_course_approval_required(args.uid, args.approval_required)
    elif args.command == "approve":
        tx = client.approve_student_for_course(args.course_uid, args.student_uid, args.approved)
    elif args.command == "enroll":
        tx = client.enroll(args.course_uid, args.student_uid)
    elif args.command == "withdraw":
        tx = client.withdraw(args.course_uid, args.student_uid)
    else:
        raise RuntimeError(f"Unknown command: {args.command}")

    print(json.dumps({"txHash": tx}, indent=2))


if __name__ == "__main__":
    main()
