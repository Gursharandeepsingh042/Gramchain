import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('LoanManager', function () {
  let loanManager: any, deployer: any, backend: any
  let leader1: any, leader2: any, leader3: any, borrower: any, stranger: any

  const BACKEND_ROLE = ethers.keccak256(ethers.toUtf8Bytes('BACKEND_ROLE'))
  const GROUP_LEADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('GROUP_LEADER_ROLE'))
  const PRINCIPAL = 2500000n
  const RATE = 1800n
  const TENURE = 12n
  const POOL_ID = ethers.keccak256(ethers.toUtf8Bytes('test-pool'))
  const TX_REF = ethers.keccak256(ethers.toUtf8Bytes('UPI-TXN-001'))
  const upiRef = (i: number) => ethers.keccak256(ethers.toUtf8Bytes(`EMI-${i}`))

  beforeEach(async function () {
    ;[deployer, backend, leader1, leader2, leader3, borrower, stranger] = await ethers.getSigners()
    const F = await ethers.getContractFactory('LoanManager')
    loanManager = await F.deploy(backend.address, 2)
    await loanManager.waitForDeployment()
    await loanManager.addGroupLeader(leader1.address)
    await loanManager.addGroupLeader(leader2.address)
    await loanManager.addGroupLeader(leader3.address)
  })

  async function createAndApprove() {
    await loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID)
    // Backend relays approval on behalf of leader1 and leader2
    await loanManager.connect(backend).approveLoan(1, leader1.address)
    await loanManager.connect(backend).approveLoan(1, leader2.address)
  }

  async function createApproveDisburse() {
    await createAndApprove()
    await loanManager.connect(backend).markDisbursed(1, TX_REF)
  }

  describe('Creation', function () {
    it('creates loan in PENDING', async function () {
      await loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID)
      const l = await loanManager.getLoan(1)
      expect(l.borrower).to.equal(borrower.address)
      expect(l.principalPaise).to.equal(PRINCIPAL)
      expect(l.status).to.equal(0)
    })
    it('emits LoanCreated with correct EMI', async function () {
      const emi = PRINCIPAL / TENURE + (PRINCIPAL * RATE) / (10000n * 12n)
      await expect(loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID))
        .to.emit(loanManager, 'LoanCreated').withArgs(1, borrower.address, PRINCIPAL, RATE, TENURE, emi, (v: any) => true)
    })
    it('tracks borrower loans', async function () {
      await loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID)
      await loanManager.connect(backend).createLoan(borrower.address, 5000000n, RATE, 6n, POOL_ID)
      expect((await loanManager.getBorrowerLoans(borrower.address)).length).to.equal(2)
    })
    it('reverts zero amount', async function () {
      await expect(loanManager.connect(backend).createLoan(borrower.address, 0, RATE, TENURE, POOL_ID))
        .to.be.revertedWithCustomError(loanManager, 'ZeroAmount')
    })
    it('reverts zero tenure', async function () {
      await expect(loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, 0, POOL_ID))
        .to.be.revertedWithCustomError(loanManager, 'ZeroTenure')
    })
    it('rejects non-BACKEND_ROLE', async function () {
      await expect(loanManager.connect(stranger).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID)).to.be.reverted
    })
  })

  describe('Approval', function () {
    beforeEach(async () => { await loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID) })
    it('moves to APPROVED after quorum (backend relayed)', async function () {
      await loanManager.connect(backend).approveLoan(1, leader1.address)
      await loanManager.connect(backend).approveLoan(1, leader2.address)
      expect((await loanManager.getLoan(1)).status).to.equal(1)
    })
    it('moves to APPROVED after quorum (direct leader call)', async function () {
      await loanManager.connect(leader1).approveLoan(1, leader1.address)
      await loanManager.connect(leader2).approveLoan(1, leader2.address)
      expect((await loanManager.getLoan(1)).status).to.equal(1)
    })
    it('stays PENDING with 1 of 2', async function () {
      await loanManager.connect(backend).approveLoan(1, leader1.address)
      expect((await loanManager.getLoan(1)).status).to.equal(0)
    })
    it('reverts duplicate approval', async function () {
      await loanManager.connect(backend).approveLoan(1, leader1.address)
      await expect(loanManager.connect(backend).approveLoan(1, leader1.address)).to.be.revertedWithCustomError(loanManager, 'AlreadyApproved')
    })
    it('rejects non-leader stranger calling directly', async function () {
      await expect(loanManager.connect(stranger).approveLoan(1, stranger.address)).to.be.reverted
    })
    it('SECURITY: backend cannot forge approval for non-leader address', async function () {
      // stranger does not have GROUP_LEADER_ROLE — backend relaying them should revert
      await expect(loanManager.connect(backend).approveLoan(1, stranger.address)).to.be.revertedWith(
        'Relayed leader does not have GROUP_LEADER_ROLE'
      )
    })
    it('SECURITY: leader cannot spoof another leaders address in direct call', async function () {
      // leader1 cannot pass leader2.address in a direct call
      await expect(loanManager.connect(leader1).approveLoan(1, leader2.address)).to.be.revertedWith(
        'Leader param must equal msg.sender for direct calls'
      )
    })
    it('reverts for non-existent loan', async function () {
      await expect(loanManager.connect(backend).approveLoan(999, leader1.address)).to.be.revertedWithCustomError(loanManager, 'LoanNotFound')
    })
  })

  describe('Disbursement', function () {
    beforeEach(createAndApprove)
    it('marks disbursed → ACTIVE', async function () {
      await loanManager.connect(backend).markDisbursed(1, TX_REF)
      const l = await loanManager.getLoan(1)
      expect(l.status).to.equal(2)
      expect(l.disbursalTxRef).to.equal(TX_REF)
    })
    it('sets timestamps', async function () {
      await loanManager.connect(backend).markDisbursed(1, TX_REF)
      const l = await loanManager.getLoan(1)
      expect(l.disbursedAt).to.be.gt(0)
      expect(l.nextEmiDueAt).to.be.gt(l.disbursedAt)
    })
    it('reverts double disburse', async function () {
      await loanManager.connect(backend).markDisbursed(1, TX_REF)
      await expect(loanManager.connect(backend).markDisbursed(1, TX_REF)).to.be.revertedWithCustomError(loanManager, 'InvalidLoanStatus')
    })
    it('rejects non-BACKEND_ROLE', async function () {
      await expect(loanManager.connect(stranger).markDisbursed(1, TX_REF)).to.be.reverted
    })
  })

  describe('EMI Payment', function () {
    beforeEach(createApproveDisburse)
    it('records EMI', async function () {
      await loanManager.connect(backend).markEmiPaid(1, upiRef(0))
      expect((await loanManager.getLoan(1)).emisPaid).to.equal(1)
    })
    it('marks REPAID after all EMIs', async function () {
      for (let i = 0; i < Number(TENURE); i++) await loanManager.connect(backend).markEmiPaid(1, upiRef(i))
      expect((await loanManager.getLoan(1)).status).to.equal(3)
    })
    it('reverts repay on REPAID loan', async function () {
      for (let i = 0; i < Number(TENURE); i++) await loanManager.connect(backend).markEmiPaid(1, upiRef(i))
      await expect(loanManager.connect(backend).markEmiPaid(1, upiRef(99))).to.be.revertedWithCustomError(loanManager, 'InvalidLoanStatus')
    })
    it('rejects non-BACKEND_ROLE', async function () {
      await expect(loanManager.connect(stranger).markEmiPaid(1, upiRef(0))).to.be.reverted
    })
  })

  describe('Default Detection', function () {
    beforeEach(createApproveDisburse)
    it('marks default after grace period', async function () {
      await ethers.provider.send('evm_increaseTime', [61 * 86400])
      await ethers.provider.send('evm_mine', [])
      await loanManager.checkDefault(1)
      expect((await loanManager.getLoan(1)).status).to.equal(4)
    })
    it('reverts if not overdue', async function () {
      await expect(loanManager.checkDefault(1)).to.be.revertedWithCustomError(loanManager, 'LoanNotOverdue')
    })
    it('anyone can call checkDefault', async function () {
      await ethers.provider.send('evm_increaseTime', [61 * 86400])
      await ethers.provider.send('evm_mine', [])
      await expect(loanManager.connect(stranger).checkDefault(1)).to.emit(loanManager, 'LoanDefaulted')
    })
  })

  describe('Role Management', function () {
    it('admin adds leaders', async function () {
      await loanManager.addGroupLeader(stranger.address)
      expect(await loanManager.hasRole(GROUP_LEADER_ROLE, stranger.address)).to.be.true
    })
    it('admin removes leaders', async function () {
      await loanManager.removeGroupLeader(leader1.address)
      expect(await loanManager.hasRole(GROUP_LEADER_ROLE, leader1.address)).to.be.false
    })
    it('admin updates quorum', async function () {
      await loanManager.setApprovalQuorum(3)
      expect(await loanManager.approvalQuorum()).to.equal(3)
    })
    it('rejects non-admin', async function () {
      await expect(loanManager.connect(stranger).addGroupLeader(stranger.address)).to.be.reverted
    })
  })

  describe('Full Lifecycle', function () {
    it('PENDING → APPROVED → ACTIVE → REPAID', async function () {
      await loanManager.connect(backend).createLoan(borrower.address, PRINCIPAL, RATE, TENURE, POOL_ID)
      expect((await loanManager.getLoan(1)).status).to.equal(0)
      await loanManager.connect(backend).approveLoan(1, leader1.address)
      await loanManager.connect(backend).approveLoan(1, leader2.address)
      expect((await loanManager.getLoan(1)).status).to.equal(1)
      await loanManager.connect(backend).markDisbursed(1, TX_REF)
      expect((await loanManager.getLoan(1)).status).to.equal(2)
      for (let i = 0; i < Number(TENURE); i++) await loanManager.connect(backend).markEmiPaid(1, upiRef(i))
      expect((await loanManager.getLoan(1)).status).to.equal(3)
    })
  })
})
