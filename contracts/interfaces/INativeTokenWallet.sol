// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @dev Interface of INativeERC20
 */
interface INativeTokenWallet {
    /**
     * @notice Deposits an amount of tokens to a particular address
     * @dev Can only be called by the predicate or owner address
     * @param account Account of the user to mint the tokens to
     * @param amount Amount of tokens to mint to the account
     * @return bool Returns true if function call is successful
     */
    function deposit(address account, uint256 amount) external returns (bool);

    /**
     * @notice Withdraw an amount of tokens from a particular address
     * @dev Can only be called by the predicate address
     * @param amount Amount of tokens to burn from the account
     */
    function withdraw(uint256 amount) external;
}
