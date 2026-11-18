Ethernaut's motorbike has a brand new upgradeable engine design.

Would you be able to `selfdestruct` its engine and make the motorbike unusable ?

Things that might help:

- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)
- [UUPS](https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786) upgradeable pattern
- [Initializable](https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/core/contracts/Initializable.sol) contract

Note: since the Cancun upgrade, [EIP-6780](https://eips.ethereum.org/EIPS/eip-6780) changed `selfdestruct`. It now removes the contract code only when it runs in the same transaction that created the contract. If you destroy the engine in a later transaction, its code stays and the level is not complete. The level can still be solved within these rules, so think about what you can do inside a single transaction.
