// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGatewayStructs} from "./IGatewayStructs.sol";

interface INativeTokenPredicate is IGatewayStructs {
    function deposit(
        bytes calldata data,
        address relayer,
        uint16 currencyTokenId
    ) external returns (bool);

    function withdraw(
        address sender,
        ReceiverWithdraw calldata _receiver
    ) external;

    function setTokenAddress(uint16 tokenId, address tokenAddress) external;

    function resetBatchId() external;

    function isTokenRegistered(uint16 tokenId) external returns (bool);

    function setTokenAsLockUnlockToken(uint16 tokenId) external;

    function getTokenAddress(uint16 tokenId) external view returns (address);

    function getNativeTokenWalletAddress() external view returns (address);
}
