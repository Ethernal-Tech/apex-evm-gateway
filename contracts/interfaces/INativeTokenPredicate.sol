// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGatewayStructs} from "./IGatewayStructs.sol";

interface INativeTokenPredicate is IGatewayStructs {
    function deposit(
        bytes calldata data,
        address relayer,
        uint256 tokenId
    ) external returns (bool);

    function withdraw(
        ReceiverWithdraw[] calldata receivers,
        uint256 tokenId
    ) external;

    function setTokenAsLockUnlockToken(uint256 tokenId) external;

    function setTokenAddress(uint256 tokenId, address tokenAddress) external;

    function resetBatchId() external;

    function isTokenRegistered(uint256 tokenId) external returns (bool);
}
