import streamlit as st
from pathlib import Path

from backend.contract_client import CourseLedgerClient


st.set_page_config(page_title="Course Registration Ledger", page_icon="🎓", layout="wide")

st.markdown(
    """
    <style>
    .main { background: linear-gradient(180deg, #f6fbff 0%, #f7fff7 100%); }
    .block-container { padding-top: 1.5rem; }
    .hero {
        background: linear-gradient(120deg, #0f766e, #0369a1);
        color: white;
        border-radius: 18px;
        padding: 18px 22px;
        margin-bottom: 16px;
        box-shadow: 0 12px 24px rgba(15, 118, 110, 0.22);
    }
    .hero h1 { margin: 0; font-size: 2rem; }
    .hero p { margin: 0.35rem 0 0 0; opacity: 0.95; }
    .card {
        border: 1px solid #d4e7e5;
        border-radius: 14px;
        padding: 12px 14px;
        background: #ffffff;
    }
    .metric-wrap {
        border-radius: 14px;
        border: 1px solid #dde7f2;
        background: #ffffff;
        padding: 10px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def load_last_deployed_address() -> str:
    address_path = Path(__file__).resolve().parents[1] / "deployed-address.txt"
    if not address_path.exists():
        return "0x5FbDB2315678afecb367f032d93F642f64180aa3"

    address = address_path.read_text(encoding="utf-8").strip()
    return address or "0x5FbDB2315678afecb367f032d93F642f64180aa3"


def load_demo_private_key() -> str:
    return "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def course_exists(course_uid: str) -> bool:
    try:
        return bool(course_uid.strip()) and client.get_course(course_uid)["exists"]
    except Exception:
        return False


def student_exists(student_uid: str) -> bool:
    try:
        return bool(student_uid.strip()) and client.get_student(student_uid)["exists"]
    except Exception:
        return False

st.markdown(
    """
    <div class="hero">
      <h1>Course Registration Ledger</h1>
            <p>Secure blockchain-based course registration system.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

with st.sidebar:
    st.header("Connection")
    rpc_url = st.text_input("RPC URL", value="http://127.0.0.1:8545")
    contract_address = st.text_input("Contract Address", value=load_last_deployed_address())
    private_key = st.text_input("Private Key (for write ops)", value=load_demo_private_key(), type="password")

    st.caption("If you redeploy, this field will match the latest address written by the deploy script.")

    st.caption("Use the Hardhat local demo key for write actions.")

    if st.button("Connect", use_container_width=True):
        try:
            if private_key and len(private_key.strip()) != 66:
                raise RuntimeError("Private key must be a 66-character hex string starting with 0x.")

            st.session_state["client"] = CourseLedgerClient(
                rpc_url=rpc_url,
                contract_address=contract_address,
                private_key=private_key or None,
            )
            st.success("Connected")
        except Exception as e:
            st.error(f"Connection failed: {e}")


client = st.session_state.get("client")
if not client:
    st.info("Connect from the left panel to begin.")
    st.stop()

try:
    owner_value = client.owner()
    ledger_entries = client.ledger_count()
except Exception as exc:
    st.error(
        "The contract address is connected to a network, but no valid CourseRegistrationLedger contract is deployed there. "
        "Re-check the deployed address and make sure it matches the running Hardhat node."
    )
    st.code(str(exc))
    st.stop()

col1, col2, col3 = st.columns(3)
with col1:
    st.markdown('<div class="metric-wrap">', unsafe_allow_html=True)
    st.metric("Owner", owner_value)
    st.markdown("</div>", unsafe_allow_html=True)
with col2:
    st.markdown('<div class="metric-wrap">', unsafe_allow_html=True)
    st.metric("Ledger Entries", ledger_entries)
    st.markdown("</div>", unsafe_allow_html=True)
with col3:
    st.markdown('<div class="metric-wrap">', unsafe_allow_html=True)
    st.metric("Contract", client.contract_address)
    st.markdown("</div>", unsafe_allow_html=True)

student_tab, admin_tab, monitor_tab = st.tabs(["Student", "Admin", "Monitor"])

with student_tab:
    st.subheader("Enroll / Withdraw")
    st.caption("First register the student and create the course in the Admin tab, then enroll here.")
    c1, c2 = st.columns(2)
    with c1:
        course_uid = st.text_input("Course UID", key="stu_course")
    with c2:
        student_uid = st.text_input("Student UID", key="stu_uid")

    a1, a2, a3 = st.columns(3)
    with a1:
        if st.button("Enroll", use_container_width=True):
            try:
                if not student_uid.strip():
                    raise RuntimeError("Enter a student UID first.")
                if not course_uid.strip():
                    raise RuntimeError("Enter a course UID first.")
                if not student_exists(student_uid):
                    raise RuntimeError("Register this student in the Admin tab before enrolling.")
                if not course_exists(course_uid):
                    raise RuntimeError("Create this course in the Admin tab before enrolling.")
                tx = client.enroll(course_uid, student_uid)
                st.success(f"Enrolled. Tx: {tx}")
            except Exception as e:
                st.error(str(e))
    with a2:
        if st.button("Withdraw", use_container_width=True):
            try:
                if not student_uid.strip():
                    raise RuntimeError("Enter a student UID first.")
                if not course_uid.strip():
                    raise RuntimeError("Enter a course UID first.")
                if not student_exists(student_uid):
                    raise RuntimeError("Register this student in the Admin tab before withdrawing.")
                if not course_exists(course_uid):
                    raise RuntimeError("Create this course in the Admin tab before withdrawing.")
                tx = client.withdraw(course_uid, student_uid)
                st.success(f"Withdrawn. Tx: {tx}")
            except Exception as e:
                st.error(str(e))
    with a3:
        if st.button("Check Enrollment", use_container_width=True):
            try:
                if not student_uid.strip():
                    raise RuntimeError("Enter a student UID first.")
                if not course_uid.strip():
                    raise RuntimeError("Enter a course UID first.")
                if not student_exists(student_uid):
                    raise RuntimeError("Register this student in the Admin tab before checking enrollment.")
                if not course_exists(course_uid):
                    raise RuntimeError("Create this course in the Admin tab before checking enrollment.")
                st.info(f"isEnrolled: {client.is_enrolled(course_uid, student_uid)}")
            except Exception as e:
                st.error(str(e))

with admin_tab:
    st.subheader("Student Management")
    s1, s2, s3 = st.columns([1, 1, 0.7])
    with s1:
        student_uid_admin = st.text_input("Student UID", key="adm_stu_uid")
    with s2:
        student_wallet = st.text_input("Student Wallet", key="adm_stu_wallet")
    with s3:
        eligible = st.selectbox("Eligible", [True, False], key="adm_stu_eligible")

    b1, b2 = st.columns(2)
    with b1:
        if st.button("Register Student", use_container_width=True):
            try:
                tx = client.register_student(student_uid_admin, student_wallet, eligible)
                st.success(f"Student registered. Tx: {tx}")
            except Exception as e:
                st.error(str(e))
    with b2:
        if st.button("Set Eligibility", use_container_width=True):
            try:
                tx = client.set_student_eligibility(student_uid_admin, eligible)
                st.success(f"Eligibility updated. Tx: {tx}")
            except Exception as e:
                st.error(str(e))

    st.subheader("Course Management")
    k1, k2, k3, k4 = st.columns([1, 1.2, 0.7, 0.8])
    with k1:
        course_uid_admin = st.text_input("Course UID", key="adm_course_uid")
    with k2:
        course_title = st.text_input("Course Title", key="adm_course_title")
    with k3:
        capacity = st.number_input("Capacity", min_value=1, value=2, step=1)
    with k4:
        approval_required = st.selectbox("Approval Required", [False, True])

    cta1, cta2, cta3 = st.columns(3)
    with cta1:
        if st.button("Create Course", use_container_width=True):
            try:
                tx = client.create_course(course_uid_admin, course_title, int(capacity), approval_required)
                st.success(f"Course created. Tx: {tx}")
            except Exception as e:
                st.error(str(e))
    with cta2:
        if st.button("Update Capacity", use_container_width=True):
            try:
                tx = client.update_course_capacity(course_uid_admin, int(capacity))
                st.success(f"Capacity updated. Tx: {tx}")
            except Exception as e:
                st.error(str(e))
    with cta3:
        if st.button("Set Approval Rule", use_container_width=True):
            try:
                tx = client.set_course_approval_required(course_uid_admin, approval_required)
                st.success(f"Approval rule updated. Tx: {tx}")
            except Exception as e:
                st.error(str(e))

    st.subheader("Approvals")
    ap1, ap2, ap3 = st.columns(3)
    with ap1:
        ap_course = st.text_input("Approve: Course UID", key="ap_course")
    with ap2:
        ap_student = st.text_input("Approve: Student UID", key="ap_student")
    with ap3:
        ap_flag = st.selectbox("Approved", [True, False], key="ap_flag")

    if st.button("Set Student Approval", use_container_width=True):
        try:
            tx = client.approve_student_for_course(ap_course, ap_student, ap_flag)
            st.success(f"Approval updated. Tx: {tx}")
        except Exception as e:
            st.error(str(e))

with monitor_tab:
    st.subheader("Status and Lookup")
    m1, m2 = st.columns(2)

    with m1:
        lookup_course = st.text_input("Lookup Course UID", key="lookup_course")
        if st.button("Get Course + Snapshot", use_container_width=True):
            try:
                course_data = client.get_course(lookup_course)
                st.json(course_data)
                snapshot = client.get_course_snapshot(lookup_course)
                st.json(snapshot)
            except Exception as e:
                st.error(str(e))

    with m2:
        lookup_student = st.text_input("Lookup Student UID", key="lookup_student")
        if st.button("Get Student", use_container_width=True):
            try:
                st.json(client.get_student(lookup_student))
            except Exception as e:
                st.error(str(e))
