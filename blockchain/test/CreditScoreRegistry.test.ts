import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('CreditScoreRegistry', function () {
  let registry: any, deployer: any, oracle: any, stranger: any, member: any

  const ML_ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ML_ORACLE_ROLE'))
  const MODEL_VER = ethers.keccak256(ethers.toUtf8Bytes('gramchain-ml-v1.0'))

  beforeEach(async function () {
    ;[deployer, oracle, stranger, member] = await ethers.getSigners()
    const F = await ethers.getContractFactory('CreditScoreRegistry')
    registry = await F.deploy(deployer.address, oracle.address)
    await registry.waitForDeployment()
  })

  describe('Deployment', function () {
    it('grants ML_ORACLE_ROLE to oracle', async function () {
      expect(await registry.hasRole(ML_ORACLE_ROLE, oracle.address)).to.be.true
    })
    it('stranger does not have ML_ORACLE_ROLE', async function () {
      expect(await registry.hasRole(ML_ORACLE_ROLE, stranger.address)).to.be.false
    })
    it('totalEntries starts at zero', async function () {
      expect(await registry.totalEntries()).to.equal(0)
    })
  })

  describe('recordScore', function () {
    it('oracle can record a score', async function () {
      await expect(registry.connect(oracle).recordScore(member.address, 750, 'LOW', MODEL_VER))
        .to.emit(registry, 'ScoreRecorded')
        .withArgs(member.address, 750, 'LOW', MODEL_VER, (v: any) => true)
    })
    it('increments totalEntries', async function () {
      await registry.connect(oracle).recordScore(member.address, 750, 'LOW', MODEL_VER)
      expect(await registry.totalEntries()).to.equal(1)
    })
    it('updates latestScore', async function () {
      await registry.connect(oracle).recordScore(member.address, 750, 'LOW', MODEL_VER)
      const [score, riskBand] = await registry.getLatestScore(member.address)
      expect(score).to.equal(750)
      expect(riskBand).to.equal('LOW')
    })
    it('stranger cannot record a score', async function () {
      await expect(registry.connect(stranger).recordScore(member.address, 750, 'LOW', MODEL_VER))
        .to.be.reverted
    })
    it('reverts for score below 300', async function () {
      await expect(registry.connect(oracle).recordScore(member.address, 299, 'HIGH', MODEL_VER))
        .to.be.revertedWith('Score out of range')
    })
    it('reverts for score above 900', async function () {
      await expect(registry.connect(oracle).recordScore(member.address, 901, 'LOW', MODEL_VER))
        .to.be.revertedWith('Score out of range')
    })
    it('accepts boundary scores 300 and 900', async function () {
      await expect(registry.connect(oracle).recordScore(member.address, 300, 'HIGH', MODEL_VER))
        .to.not.be.reverted
      await expect(registry.connect(oracle).recordScore(member.address, 900, 'LOW', MODEL_VER))
        .to.not.be.reverted
    })
  })

  describe('Score History', function () {
    it('accumulates score history entries', async function () {
      await registry.connect(oracle).recordScore(member.address, 650, 'MEDIUM', MODEL_VER)
      await registry.connect(oracle).recordScore(member.address, 700, 'LOW', MODEL_VER)
      await registry.connect(oracle).recordScore(member.address, 720, 'LOW', MODEL_VER)
      const history = await registry.getScoreHistory(member.address)
      expect(history.length).to.equal(3)
      expect(history[0].score).to.equal(650)
      expect(history[2].score).to.equal(720)
    })

    it('getLatestScore returns the most recent score', async function () {
      await registry.connect(oracle).recordScore(member.address, 600, 'HIGH', MODEL_VER)
      await registry.connect(oracle).recordScore(member.address, 800, 'LOW', MODEL_VER)
      const [score, riskBand] = await registry.getLatestScore(member.address)
      expect(score).to.equal(800)
      expect(riskBand).to.equal('LOW')
    })

    it('getScoreCount returns correct count', async function () {
      await registry.connect(oracle).recordScore(member.address, 700, 'LOW', MODEL_VER)
      await registry.connect(oracle).recordScore(member.address, 720, 'LOW', MODEL_VER)
      expect(await registry.getScoreCount(member.address)).to.equal(2)
    })

    it('returns empty array for member with no scores', async function () {
      const history = await registry.getScoreHistory(stranger.address)
      expect(history.length).to.equal(0)
    })

    it('histories are independent per member', async function () {
      await registry.connect(oracle).recordScore(member.address, 700, 'LOW', MODEL_VER)
      await registry.connect(oracle).recordScore(stranger.address, 550, 'HIGH', MODEL_VER)
      expect(await registry.getScoreCount(member.address)).to.equal(1)
      expect(await registry.getScoreCount(stranger.address)).to.equal(1)
      const [memberScore] = await registry.getLatestScore(member.address)
      const [strangerScore] = await registry.getLatestScore(stranger.address)
      expect(memberScore).to.equal(700)
      expect(strangerScore).to.equal(550)
    })
  })
})
