export const SHG_POOL_ABI = [
  'function proposeLoan(address borrower, uint256 amountPaise, uint256 tenureMonths) external returns (bytes32)',
  'function approveLoan(bytes32 proposalId) external',
  'function executeLoan(bytes32 proposalId) external',
  'function getProposal(bytes32 proposalId) external view returns (tuple(bytes32 proposalId, address borrower, uint256 amountPaise, uint256 tenureMonths, uint256 approvalCount, uint8 status, uint256 createdAt))',
  'function hasApproved(bytes32 proposalId, address leader) external view returns (bool)',
  'event LoanProposed(bytes32 indexed proposalId, address indexed borrower, uint256 amountPaise, uint256 tenureMonths, uint256 timestamp)',
  'event LoanExecuted(bytes32 indexed proposalId, address indexed borrower, uint256 amountPaise, uint256 timestamp)',
]
