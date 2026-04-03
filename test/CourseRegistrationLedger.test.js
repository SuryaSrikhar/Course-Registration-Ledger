const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CourseRegistrationLedger", function () {
  async function deployFixture() {
    const [owner, registrar, student1, student2] = await ethers.getSigners();
    const ledger = await ethers.deployContract("CourseRegistrationLedger");
    await ledger.waitForDeployment();

    return { ledger, owner, registrar, student1, student2 };
  }

  it("records a successful enrollment and updates seat counts", async function () {
    const { ledger, student1 } = await deployFixture();

    await ledger.registerStudent("STU-001", student1.address, true);
    await ledger.createCourse("CSE-501", "Blockchain Fundamentals", 2, false);

    await ledger.connect(student1).enroll("CSE-501", "STU-001");

    const snapshot = await ledger.getCourseSnapshot("CSE-501");
    expect(snapshot.enrolled).to.equal(1);
    expect(snapshot.seatsRemaining).to.equal(1);

    const enrolled = await ledger.isEnrolled("CSE-501", "STU-001");
    expect(enrolled).to.equal(true);
  });

  it("prevents over-enrollment", async function () {
    const { ledger, student1, student2 } = await deployFixture();

    await ledger.registerStudent("STU-001", student1.address, true);
    await ledger.registerStudent("STU-002", student2.address, true);
    await ledger.createCourse("CSE-502", "Smart Contracts", 1, false);

    await ledger.connect(student1).enroll("CSE-502", "STU-001");

    await expect(ledger.connect(student2).enroll("CSE-502", "STU-002")).to.be.revertedWith("Course full");
  });

  it("blocks enrollment until approval when course approval is required", async function () {
    const { ledger, student1 } = await deployFixture();

    await ledger.registerStudent("STU-100", student1.address, true);
    await ledger.createCourse("CSE-503", "Distributed Systems", 2, true);

    await expect(ledger.connect(student1).enroll("CSE-503", "STU-100")).to.be.revertedWith("Approval required");

    await ledger.approveStudentForCourse("CSE-503", "STU-100", true);
    await ledger.connect(student1).enroll("CSE-503", "STU-100");

    const enrolled = await ledger.isEnrolled("CSE-503", "STU-100");
    expect(enrolled).to.equal(true);
  });

  it("supports withdrawal and frees a seat", async function () {
    const { ledger, student1 } = await deployFixture();

    await ledger.registerStudent("STU-010", student1.address, true);
    await ledger.createCourse("CSE-504", "Consensus Protocols", 2, false);
    await ledger.connect(student1).enroll("CSE-504", "STU-010");

    await ledger.connect(student1).withdrawFromCourse("CSE-504", "STU-010");

    const snapshot = await ledger.getCourseSnapshot("CSE-504");
    expect(snapshot.enrolled).to.equal(0);
    expect(snapshot.seatsRemaining).to.equal(2);
  });

  it("enforces eligibility checks", async function () {
    const { ledger, student1 } = await deployFixture();

    await ledger.registerStudent("STU-777", student1.address, false);
    await ledger.createCourse("CSE-505", "Enterprise Blockchain", 3, false);

    await expect(ledger.connect(student1).enroll("CSE-505", "STU-777")).to.be.revertedWith("Student not eligible");

    await ledger.setStudentEligibility("STU-777", true);
    await ledger.connect(student1).enroll("CSE-505", "STU-777");

    const enrolled = await ledger.isEnrolled("CSE-505", "STU-777");
    expect(enrolled).to.equal(true);
  });

  it("prevents capacity updates below currently enrolled students", async function () {
    const { ledger, student1 } = await deployFixture();

    await ledger.registerStudent("STU-020", student1.address, true);
    await ledger.createCourse("CSE-506", "Security", 2, false);
    await ledger.connect(student1).enroll("CSE-506", "STU-020");

    await expect(ledger.updateCourseCapacity("CSE-506", 0)).to.be.revertedWith("Capacity below enrolled");
    await expect(ledger.updateCourseCapacity("CSE-506", 1)).to.not.be.reverted;
  });

  it("tracks immutable ledger entries for operational actions", async function () {
    const { ledger, student1 } = await deployFixture();

    await ledger.registerStudent("STU-030", student1.address, true);
    await ledger.createCourse("CSE-507", "Privacy", 2, false);
    await ledger.connect(student1).enroll("CSE-507", "STU-030");
    await ledger.connect(student1).withdrawFromCourse("CSE-507", "STU-030");

    const count = await ledger.ledgerCount();
    expect(count).to.equal(4);
  });
});
