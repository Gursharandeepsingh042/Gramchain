import { expect } from 'chai'
import { ethers } from 'hardhat'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'

describe('SHGPool', function () {
  let pool: any, deployer: any, backend: any
  let member1: any, member2: any, member3: any, borrower: any, stranger: any

  const AMOUNT = 2500000n  // ₹25,000 in paise
  const TENURE = 12n

  beforeEach(async function () {
    ;[deployer, backend, member1, member2, member3, borrower, stranger] = await ethers.getSigners()
    const F = await ethers.getContractFactory('SHGPool')
    pool = await F.deploy(
      [member1.address, member2.address, member3.address],
      2,
      'TestSHG',
      backend.address
    )
    await pool.waitForDeployment()
  })

  describe('Deployment', function () {
    it('sets pool name correctly', async function () {
      expect(await pool.shgName()).to.equal('TestSHG')
    })
    it('sets quorum threshold correctly', async function () {
      expect(await pool.quorumThreshold()).to.equal(2)
    })
    it('sets member count correctly', async function () {
      expect(await pool.memberCount()).to.equal(3)
    })
    it('reverts if quorum > member count', async function () {
      const F = await ethers.getContractFactory('SHGPool')
      await expect(F.deploy([member1.address], 2, 'BadPool', backend.address))
        .to.be.revertedWithCustomError(pool, 'InvalidQuorum')
    })
    it('reverts if quorum is zero', async function () {
      const F = await ethers.getContractFactory('SHGPool')
      await expect(F.deploy([member1.address, member2.address], 0, 'ZeroQuorum', backend.address))
        .to.be.revertedWithCustomError(pool, 'InvalidQuorum')
    })
  })

  describe('Loan Proposal', function () {
    it('member can propose a loan', async function () {
      const tx = await pool.connect(member1).proposeLoan(borrower.address, AMOUNT, TENURE)
      const receipt = await tx.wait()
      const event = receipt.logs.find((l: any) => l.fragment?.name === 'LoanProposed')
      expect(event).to.not.be.undefined
      expect(event.args.borrower).to.equal(borrower.address)
      expect(event.args.amountPaise).to.equal(AMOUNT)
    })
    it('reverts for zero amount', async function () {
      await expect(pool.connect(member1).proposeLoan(borrower.address, 0, TENURE))
        .to.be.revertedWithCustomError(pool, 'ZeroAmount')
    })
    it('reverts for zero tenure', async function () {
      await expect(pool.connect(member1).proposeLoan(borrower.address, AMOUNT, 0))
        .to.be.revertedWithCustomError(pool, 'ZeroTenure')
    })
    it('stranger cannot propose', async function () {
      await expect(pool.connect(stranger).proposeLoan(borrower.address, AMOUNT, TENURE)).to.be.reverted
    })
  })

  describe('Loan Approval → Quorum', function () {
    let proposalId: string

    beforeEach(async function () {
      const tx = await pool.connect(member1).proposeLoan(borrower.address, AMOUNT, TENURE)
      const receipt = await tx.wait()
      const event = receipt.logs.find((l: any) => l.fragment?.name === 'LoanProposed')
      proposalId = event.args.proposalId
    })

    it('member1 approves and stays PENDING', async function () {
      await pool.connect(member1).approveLoan(proposalId)
      const p = await pool.getProposal(proposalId)
      expect(p.approvalCount).to.equal(1)
      expect(p.status).to.equal(0) // PENDING
    })
    it('quorum reached after 2 approvals', async function () {
      await pool.connect(member1).approveLoan(proposalId)
      await pool.connect(member2).approveLoan(proposalId)
      const p = await pool.getProposal(proposalId)
      expect(p.status).to.equal(1) // QUORUM_REACHED
    })
    it('emits QuorumReached event', async function () {
      await pool.connect(member1).approveLoan(proposalId)
      await expect(pool.connect(member2).approveLoan(proposalId))
        .to.emit(pool, 'QuorumReached')
    })
    it('reverts double approval from same member', async function () {
      await pool.connect(member1).approveLoan(proposalId)
      await expect(pool.connect(member1).approveLoan(proposalId))
        .to.be.revertedWithCustomError(pool, 'AlreadyApproved')
    })
    it('stranger cannot approve', async function () {
      await expect(pool.connect(stranger).approveLoan(proposalId)).to.be.reverted
    })
  })

  describe('Loan Execution', function () {
    let proposalId: string

    beforeEach(async function () {
      const tx = await pool.connect(member1).proposeLoan(borrower.address, AMOUNT, TENURE)
      const receipt = await tx.wait()
      const event = receipt.logs.find((l: any) => l.fragment?.name === 'LoanProposed')
      proposalId = event.args.proposalId
      await pool.connect(member1).approveLoan(proposalId)
      await pool.connect(member2).approveLoan(proposalId)
    })

    it('backend can execute after quorum', async function () {
      await expect(pool.connect(backend).executeLoan(proposalId)).to.emit(pool, 'LoanExecuted')
    })
    it('proposal status becomes EXECUTED', async function () {
      await pool.connect(backend).executeLoan(proposalId)
      const p = await pool.getProposal(proposalId)
      expect(p.status).to.equal(2) // EXECUTED
    })
    it('cannot execute twice', async function () {
      await pool.connect(backend).executeLoan(proposalId)
      await expect(pool.connect(backend).executeLoan(proposalId))
        .to.be.revertedWithCustomError(pool, 'QuorumNotReached')
    })
    it('stranger cannot execute', async function () {
      await expect(pool.connect(stranger).executeLoan(proposalId)).to.be.reverted
    })
    it('reverts execute before quorum reached', async function () {
      const tx2 = await pool.connect(member1).proposeLoan(borrower.address, AMOUNT, TENURE)
      const r2 = await tx2.wait()
      const e2 = r2.logs.find((l: any) => l.fragment?.name === 'LoanProposed')
      const pid2 = e2.args.proposalId
      await expect(pool.connect(backend).executeLoan(pid2))
        .to.be.revertedWithCustomError(pool, 'QuorumNotReached')
    })
  })

  describe('Member Management', function () {
    it('backend can add a new member', async function () {
      await pool.connect(backend).addMember(stranger.address)
      expect(await pool.memberCount()).to.equal(4)
      expect(await pool.getMembers()).to.include(stranger.address)
    })
    it('reverts adding existing member', async function () {
      await expect(pool.connect(backend).addMember(member2.address))
        .to.be.revertedWithCustomError(pool, 'AlreadyMember')
    })
    it('backend can remove a member', async function () {
      await pool.connect(backend).removeMember(member3.address)
      expect(await pool.memberCount()).to.equal(2)
    })
    it('removeMember compacts the members array (swap-and-pop)', async function () {
      // Initial: [member1, member2, member3]
      await pool.connect(backend).removeMember(member2.address)
      const members: string[] = await pool.getMembers()
      expect(members.length).to.equal(2)
      expect(members).to.not.include(member2.address)
      expect(members).to.include(member1.address)
      expect(members).to.include(member3.address)
    })
    it('non-backend cannot add members (admin role is no longer enough)', async function () {
      await expect(pool.connect(member1).addMember(stranger.address)).to.be.reverted
      await expect(pool.connect(stranger).addMember(stranger.address)).to.be.reverted
    })
    it('non-backend cannot remove members', async function () {
      await expect(pool.connect(member1).removeMember(member2.address)).to.be.reverted
      await expect(pool.connect(stranger).removeMember(member2.address)).to.be.reverted
    })
    it('cannot remove the last member', async function () {
      // Reduce pool to 1 member, then try to remove it
      await pool.connect(backend).removeMember(member2.address)
      await pool.connect(backend).removeMember(member3.address)
      expect(await pool.memberCount()).to.equal(1)
      await expect(pool.connect(backend).removeMember(member1.address))
        .to.be.revertedWithCustomError(pool, 'CannotRemoveLastMember')
    })
  })

  describe('Dynamic Quorum', function () {
    it('recomputes quorum to ceil(N/2)+1 on member add', async function () {
      // Start: 3 members, quorum = 2 (constructor arg). Auto-recompute on add.
      await pool.connect(backend).addMember(stranger.address) // 4 members
      expect(await pool.quorumThreshold()).to.equal(3) // 4/2 + 1 = 3

      const [, , , , , , , extra1, extra2] = await ethers.getSigners()
      await pool.connect(backend).addMember(extra1.address)   // 5 members
      expect(await pool.quorumThreshold()).to.equal(3) // 5/2 + 1 = 3
      await pool.connect(backend).addMember(extra2.address)   // 6 members
      expect(await pool.quorumThreshold()).to.equal(4) // 6/2 + 1 = 4
    })

    it('recomputes quorum on member removal', async function () {
      await pool.connect(backend).removeMember(member3.address) // 2 members
      expect(await pool.quorumThreshold()).to.equal(2) // 2/2 + 1 = 2 (unanimous)
      await pool.connect(backend).removeMember(member2.address) // 1 member
      expect(await pool.quorumThreshold()).to.equal(1) // 1/2 + 1 = 1
    })

    it('emits QuorumChanged when quorum actually changes', async function () {
      // 3 → 4 members shifts quorum from 2 → 3
      await expect(pool.connect(backend).addMember(stranger.address))
        .to.emit(pool, 'QuorumChanged')
        .withArgs(2, 3, 4, anyValue)
    })
  })

  describe('Quorum Admin Override', function () {
    it('admin can override the auto-quorum via setQuorum', async function () {
      // member1 is the DEFAULT_ADMIN
      await pool.connect(member1).setQuorum(3) // require unanimous (3-of-3)
      expect(await pool.quorumThreshold()).to.equal(3)
    })
    it('reverts setQuorum to zero', async function () {
      await expect(pool.connect(member1).setQuorum(0))
        .to.be.revertedWithCustomError(pool, 'InvalidQuorum')
    })
    it('reverts setQuorum > memberCount', async function () {
      await expect(pool.connect(member1).setQuorum(99))
        .to.be.revertedWithCustomError(pool, 'InvalidQuorum')
    })
    it('non-admin cannot setQuorum', async function () {
      await expect(pool.connect(backend).setQuorum(2)).to.be.reverted
      await expect(pool.connect(stranger).setQuorum(2)).to.be.reverted
    })
  })

  describe('Cancel Proposal', function () {
    it('admin can cancel a pending proposal', async function () {
      const tx = await pool.connect(member1).proposeLoan(borrower.address, AMOUNT, TENURE)
      const receipt = await tx.wait()
      const event = receipt.logs.find((l: any) => l.fragment?.name === 'LoanProposed')
      const pid = event.args.proposalId
      await expect(pool.connect(member1).cancelProposal(pid)).to.emit(pool, 'ProposalCancelled')
      expect((await pool.getProposal(pid)).status).to.equal(3) // CANCELLED
    })
  })
})
