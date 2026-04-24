// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Main contract for student onboarding, course setup, approvals, enrollment, and audit history.
contract CourseRegistrationLedger {
    // Action categories stored for every immutable ledger entry.
    enum ActionType {
        StudentRegistered,
        CourseCreated,
        CapacityUpdated,
        ApprovalUpdated,
        Enrolled,
        Withdrawn,
        EligibilityUpdated
    }

    // Canonical student profile keyed by hashed student UID.
    struct Student {
        string studentUid;
        address wallet;
        bool eligible;
        bool exists;
    }

    // Canonical course profile keyed by hashed course UID.
    struct Course {
        string courseUid;
        string title;
        uint16 capacity;
        uint16 enrolled;
        bool approvalRequired;
        bool exists;
    }

    // Single append-only audit record for administrative or enrollment actions.
    struct LedgerEntry {
        uint256 timestamp;
        ActionType actionType;
        bytes32 courseKey;
        bytes32 studentKey;
        address actor;
        string memo;
    }

    // Ownership and delegated registrar permissions.
    address public owner;
    mapping(address => bool) public registrars;

    // Core storage for students, courses, enrollment/approval status, and wallet linkage.
    mapping(bytes32 => Student) private students;
    mapping(bytes32 => Course) private courses;
    mapping(bytes32 => mapping(bytes32 => bool)) private enrollments;
    mapping(bytes32 => mapping(bytes32 => bool)) private approvals;
    mapping(address => bytes32) public studentKeyByWallet;

    // Append-only ledger used for historical traceability.
    LedgerEntry[] public ledger;

    // Events emitted for off-chain indexing, UI refresh, and audit monitoring.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RegistrarUpdated(address indexed registrar, bool allowed);
    event StudentRegistered(bytes32 indexed studentKey, string studentUid, address wallet, bool eligible);
    event CourseCreated(bytes32 indexed courseKey, string courseUid, string title, uint16 capacity, bool approvalRequired);
    event CapacityUpdated(bytes32 indexed courseKey, uint16 oldCapacity, uint16 newCapacity);
    event ApprovalUpdated(bytes32 indexed courseKey, bytes32 indexed studentKey, bool approved);
    event EnrollmentChanged(bytes32 indexed courseKey, bytes32 indexed studentKey, bool enrolled, uint16 currentEnrollment, uint16 capacity);
    event EligibilityUpdated(bytes32 indexed studentKey, bool eligible);
    event LedgerRecorded(uint256 indexed entryId, ActionType actionType, bytes32 indexed courseKey, bytes32 indexed studentKey, address actor, string memo);

    // Only the current owner can call functions using this modifier.
    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    // Allows either the owner or an approved registrar.
    modifier onlyRegistrarOrOwner() {
        require(msg.sender == owner || registrars[msg.sender], "Registrar or owner only");
        _;
    }

    // Allows owner, registrar, or the student's own wallet to perform the action.
    // studentKey is the hashed student ID used to check wallet ownership.
    modifier onlyStudentSelfOrRegistrar(bytes32 studentKey) {
        require(
            msg.sender == owner ||
                registrars[msg.sender] ||
                students[studentKey].wallet == msg.sender,
            "Unauthorized actor"
        );
        _;
    }

    // Sets the deployer as owner at contract creation time.
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // Changes contract ownership to a new non-zero address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    // Adds or removes registrar permission for an address.
    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        require(registrar != address(0), "Zero registrar");
        registrars[registrar] = allowed;
        emit RegistrarUpdated(registrar, allowed);
    }

    // Creates a student record and links one wallet to that student.
    function registerStudent(string calldata studentUid, address wallet, bool eligible) external onlyRegistrarOrOwner {
        require(bytes(studentUid).length > 0, "Empty student UID");
        require(wallet != address(0), "Zero wallet");

        bytes32 studentKey = _toKey(studentUid);
        require(!students[studentKey].exists, "Student exists");
        require(studentKeyByWallet[wallet] == bytes32(0), "Wallet already linked");

        students[studentKey] = Student({
            studentUid: studentUid,
            wallet: wallet,
            eligible: eligible,
            exists: true
        });
        studentKeyByWallet[wallet] = studentKey;

        _record(ActionType.StudentRegistered, bytes32(0), studentKey, "Student onboarded");
        emit StudentRegistered(studentKey, studentUid, wallet, eligible);
    }

    // Toggles whether a student is allowed to enroll.
    function setStudentEligibility(string calldata studentUid, bool eligible) external onlyRegistrarOrOwner {
        bytes32 studentKey = _toKey(studentUid);
        require(students[studentKey].exists, "Unknown student");

        students[studentKey].eligible = eligible;

        _record(ActionType.EligibilityUpdated, bytes32(0), studentKey, "Eligibility updated");
        emit EligibilityUpdated(studentKey, eligible);
    }

    // Creates a course with title, seat limit, and approval requirement.
    function createCourse(
        string calldata courseUid,
        string calldata title,
        uint16 capacity,
        bool approvalRequired
    ) external onlyRegistrarOrOwner {
        require(bytes(courseUid).length > 0, "Empty course UID");
        require(bytes(title).length > 0, "Empty title");
        require(capacity > 0, "Zero capacity");

        bytes32 courseKey = _toKey(courseUid);
        require(!courses[courseKey].exists, "Course exists");

        courses[courseKey] = Course({
            courseUid: courseUid,
            title: title,
            capacity: capacity,
            enrolled: 0,
            approvalRequired: approvalRequired,
            exists: true
        });

        _record(ActionType.CourseCreated, courseKey, bytes32(0), "Course created");
        emit CourseCreated(courseKey, courseUid, title, capacity, approvalRequired);
    }

    // Updates seat capacity; it cannot be lower than current enrolled count.
    function updateCourseCapacity(string calldata courseUid, uint16 newCapacity) external onlyRegistrarOrOwner {
        bytes32 courseKey = _toKey(courseUid);
        require(courses[courseKey].exists, "Unknown course");
        require(newCapacity >= courses[courseKey].enrolled, "Capacity below enrolled");
        require(newCapacity > 0, "Zero capacity");

        uint16 oldCapacity = courses[courseKey].capacity;
        courses[courseKey].capacity = newCapacity;

        _record(ActionType.CapacityUpdated, courseKey, bytes32(0), "Seat capacity updated");
        emit CapacityUpdated(courseKey, oldCapacity, newCapacity);
    }

    // Turns course-level approval requirement on or off.
    function setCourseApprovalRequired(string calldata courseUid, bool approvalRequired) external onlyRegistrarOrOwner {
        bytes32 courseKey = _toKey(courseUid);
        require(courses[courseKey].exists, "Unknown course");

        courses[courseKey].approvalRequired = approvalRequired;
        _record(ActionType.ApprovalUpdated, courseKey, bytes32(0), "Course approval mode updated");
        emit ApprovalUpdated(courseKey, bytes32(0), approvalRequired);
    }

    // Grants or revokes one student's approval for one course.
    function approveStudentForCourse(
        string calldata courseUid,
        string calldata studentUid,
        bool approved
    ) external onlyRegistrarOrOwner {
        bytes32 courseKey = _toKey(courseUid);
        bytes32 studentKey = _toKey(studentUid);

        require(courses[courseKey].exists, "Unknown course");
        require(students[studentKey].exists, "Unknown student");

        approvals[courseKey][studentKey] = approved;

        _record(ActionType.ApprovalUpdated, courseKey, studentKey, approved ? "Student approved" : "Student unapproved");
        emit ApprovalUpdated(courseKey, studentKey, approved);
    }

    // Public helper: converts IDs to keys, then enrolls.
    function enroll(string calldata courseUid, string calldata studentUid) external {
        bytes32 courseKey = _toKey(courseUid);
        bytes32 studentKey = _toKey(studentUid);

        _enroll(courseKey, studentKey);
    }

    // Public helper: converts IDs to keys, then withdraws.
    function withdrawFromCourse(string calldata courseUid, string calldata studentUid) external {
        bytes32 courseKey = _toKey(courseUid);
        bytes32 studentKey = _toKey(studentUid);

        _withdraw(courseKey, studentKey);
    }

    // Returns wallet, eligibility, and existence status for a student.
    function getStudent(string calldata studentUid) external view returns (address wallet, bool eligible, bool exists) {
        bytes32 studentKey = _toKey(studentUid);
        Student memory student = students[studentKey];
        return (student.wallet, student.eligible, student.exists);
    }

    // Returns full course details for a course ID.
    function getCourse(
        string calldata courseUid
    ) external view returns (string memory title, uint16 capacity, uint16 enrolled, bool approvalRequired, bool exists) {
        bytes32 courseKey = _toKey(courseUid);
        Course memory course = courses[courseKey];
        return (course.title, course.capacity, course.enrolled, course.approvalRequired, course.exists);
    }

    // Returns capacity, enrolled count, remaining seats, and approval mode.
    function getCourseSnapshot(
        string calldata courseUid
    ) external view returns (uint16 capacity, uint16 enrolled, uint16 seatsRemaining, bool approvalRequired) {
        bytes32 courseKey = _toKey(courseUid);
        Course memory course = courses[courseKey];
        require(course.exists, "Unknown course");
        return (course.capacity, course.enrolled, course.capacity - course.enrolled, course.approvalRequired);
    }

    // Checks whether a student is approved for a course.
    function isStudentApprovedForCourse(
        string calldata courseUid,
        string calldata studentUid
    ) external view returns (bool approved) {
        return approvals[_toKey(courseUid)][_toKey(studentUid)];
    }

    // Checks whether a student is currently enrolled in a course.
    function isEnrolled(string calldata courseUid, string calldata studentUid) external view returns (bool) {
        return enrollments[_toKey(courseUid)][_toKey(studentUid)];
    }

    // Returns total number of ledger entries.
    function ledgerCount() external view returns (uint256) {
        return ledger.length;
    }

    // Internal enroll logic with all validations and counter updates.
    function _enroll(bytes32 courseKey, bytes32 studentKey) internal onlyStudentSelfOrRegistrar(studentKey) {
        require(courses[courseKey].exists, "Unknown course");
        require(students[studentKey].exists, "Unknown student");
        require(students[studentKey].eligible, "Student not eligible");
        require(!enrollments[courseKey][studentKey], "Already enrolled");
        require(courses[courseKey].enrolled < courses[courseKey].capacity, "Course full");

        if (courses[courseKey].approvalRequired) {
            require(approvals[courseKey][studentKey], "Approval required");
        }

        enrollments[courseKey][studentKey] = true;
        courses[courseKey].enrolled += 1;

        _record(ActionType.Enrolled, courseKey, studentKey, "Student enrolled");
        emit EnrollmentChanged(
            courseKey,
            studentKey,
            true,
            courses[courseKey].enrolled,
            courses[courseKey].capacity
        );
    }

    // Internal withdraw logic with all validations and counter updates.
    function _withdraw(bytes32 courseKey, bytes32 studentKey) internal onlyStudentSelfOrRegistrar(studentKey) {
        require(courses[courseKey].exists, "Unknown course");
        require(students[studentKey].exists, "Unknown student");
        require(enrollments[courseKey][studentKey], "Not enrolled");

        enrollments[courseKey][studentKey] = false;
        courses[courseKey].enrolled -= 1;

        _record(ActionType.Withdrawn, courseKey, studentKey, "Student withdrawn");
        emit EnrollmentChanged(
            courseKey,
            studentKey,
            false,
            courses[courseKey].enrolled,
            courses[courseKey].capacity
        );
    }

    // Appends an immutable audit entry and emits LedgerRecorded.
    function _record(ActionType actionType, bytes32 courseKey, bytes32 studentKey, string memory memo) internal {
        ledger.push(
            LedgerEntry({
                timestamp: block.timestamp,
                actionType: actionType,
                courseKey: courseKey,
                studentKey: studentKey,
                actor: msg.sender,
                memo: memo
            })
        );

        emit LedgerRecorded(ledger.length - 1, actionType, courseKey, studentKey, msg.sender, memo);
    }

    // Hashes a string ID into a bytes32 key used in mappings.
    function _toKey(string memory uid) internal pure returns (bytes32) {
        return keccak256(bytes(uid));
    }
}
