// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CourseRegistrationLedger {
    enum ActionType {
        StudentRegistered,
        CourseCreated,
        CapacityUpdated,
        ApprovalUpdated,
        Enrolled,
        Withdrawn,
        EligibilityUpdated
    }

    struct Student {
        string studentUid;
        address wallet;
        bool eligible;
        bool exists;
    }

    struct Course {
        string courseUid;
        string title;
        uint16 capacity;
        uint16 enrolled;
        bool approvalRequired;
        bool exists;
    }

    struct LedgerEntry {
        uint256 timestamp;
        ActionType actionType;
        bytes32 courseKey;
        bytes32 studentKey;
        address actor;
        string memo;
    }

    address public owner;
    mapping(address => bool) public registrars;

    mapping(bytes32 => Student) private students;
    mapping(bytes32 => Course) private courses;
    mapping(bytes32 => mapping(bytes32 => bool)) private enrollments;
    mapping(bytes32 => mapping(bytes32 => bool)) private approvals;
    mapping(address => bytes32) public studentKeyByWallet;

    LedgerEntry[] public ledger;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RegistrarUpdated(address indexed registrar, bool allowed);
    event StudentRegistered(bytes32 indexed studentKey, string studentUid, address wallet, bool eligible);
    event CourseCreated(bytes32 indexed courseKey, string courseUid, string title, uint16 capacity, bool approvalRequired);
    event CapacityUpdated(bytes32 indexed courseKey, uint16 oldCapacity, uint16 newCapacity);
    event ApprovalUpdated(bytes32 indexed courseKey, bytes32 indexed studentKey, bool approved);
    event EnrollmentChanged(bytes32 indexed courseKey, bytes32 indexed studentKey, bool enrolled, uint16 currentEnrollment, uint16 capacity);
    event EligibilityUpdated(bytes32 indexed studentKey, bool eligible);
    event LedgerRecorded(uint256 indexed entryId, ActionType actionType, bytes32 indexed courseKey, bytes32 indexed studentKey, address actor, string memo);

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    modifier onlyRegistrarOrOwner() {
        require(msg.sender == owner || registrars[msg.sender], "Registrar or owner only");
        _;
    }

    modifier onlyStudentSelfOrRegistrar(bytes32 studentKey) {
        require(
            msg.sender == owner ||
                registrars[msg.sender] ||
                students[studentKey].wallet == msg.sender,
            "Unauthorized actor"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        require(registrar != address(0), "Zero registrar");
        registrars[registrar] = allowed;
        emit RegistrarUpdated(registrar, allowed);
    }

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

    function setStudentEligibility(string calldata studentUid, bool eligible) external onlyRegistrarOrOwner {
        bytes32 studentKey = _toKey(studentUid);
        require(students[studentKey].exists, "Unknown student");

        students[studentKey].eligible = eligible;

        _record(ActionType.EligibilityUpdated, bytes32(0), studentKey, "Eligibility updated");
        emit EligibilityUpdated(studentKey, eligible);
    }

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

    function setCourseApprovalRequired(string calldata courseUid, bool approvalRequired) external onlyRegistrarOrOwner {
        bytes32 courseKey = _toKey(courseUid);
        require(courses[courseKey].exists, "Unknown course");

        courses[courseKey].approvalRequired = approvalRequired;
        _record(ActionType.ApprovalUpdated, courseKey, bytes32(0), "Course approval mode updated");
        emit ApprovalUpdated(courseKey, bytes32(0), approvalRequired);
    }

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

    function enroll(string calldata courseUid, string calldata studentUid) external {
        bytes32 courseKey = _toKey(courseUid);
        bytes32 studentKey = _toKey(studentUid);

        _enroll(courseKey, studentKey);
    }

    function withdrawFromCourse(string calldata courseUid, string calldata studentUid) external {
        bytes32 courseKey = _toKey(courseUid);
        bytes32 studentKey = _toKey(studentUid);

        _withdraw(courseKey, studentKey);
    }

    function getStudent(string calldata studentUid) external view returns (address wallet, bool eligible, bool exists) {
        bytes32 studentKey = _toKey(studentUid);
        Student memory student = students[studentKey];
        return (student.wallet, student.eligible, student.exists);
    }

    function getCourse(
        string calldata courseUid
    ) external view returns (string memory title, uint16 capacity, uint16 enrolled, bool approvalRequired, bool exists) {
        bytes32 courseKey = _toKey(courseUid);
        Course memory course = courses[courseKey];
        return (course.title, course.capacity, course.enrolled, course.approvalRequired, course.exists);
    }

    function getCourseSnapshot(
        string calldata courseUid
    ) external view returns (uint16 capacity, uint16 enrolled, uint16 seatsRemaining, bool approvalRequired) {
        bytes32 courseKey = _toKey(courseUid);
        Course memory course = courses[courseKey];
        require(course.exists, "Unknown course");
        return (course.capacity, course.enrolled, course.capacity - course.enrolled, course.approvalRequired);
    }

    function isStudentApprovedForCourse(
        string calldata courseUid,
        string calldata studentUid
    ) external view returns (bool approved) {
        return approvals[_toKey(courseUid)][_toKey(studentUid)];
    }

    function isEnrolled(string calldata courseUid, string calldata studentUid) external view returns (bool) {
        return enrollments[_toKey(courseUid)][_toKey(studentUid)];
    }

    function ledgerCount() external view returns (uint256) {
        return ledger.length;
    }

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

    function _toKey(string memory uid) internal pure returns (bytes32) {
        return keccak256(bytes(uid));
    }
}
