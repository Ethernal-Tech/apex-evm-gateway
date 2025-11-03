// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IGatewayStructs} from "./IGatewayStructs.sol";

/**
 * @dev Interface of INativeERC20
 */
interface INativeTokenWallet is IGatewayStructs {
    /**
     * @notice Deposits an amount of tokens to a particular address
     * @dev Can only be called by the predicate or owner address
     * @param account Account of the user to mint the tokens to
     * @param amount Amount of tokens to mint to the account
     * Reverts if the transfer fails.
     */
    function deposit(
        address account,
        uint256 amount,
        uint256 coloredCoinId
    ) external;

    function withdraw(
        ReceiverWithdraw[] calldata _receivers,
        uint256 _coloredCoinId
    ) external;

    function setColoredCoinAsLayerZeroToken(uint256 coloredCoinId) external;

    function setColoredCoinAddress(
        uint256 coloredCoinId,
        address coloredCoinAddress
    ) external;
}
