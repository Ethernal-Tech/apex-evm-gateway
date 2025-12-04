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

    function resetBatchId() external;

    function setTokenInfo(
        uint16 tokenId,
        address tokenAddress,
        bool isLockUnlock
    ) external;

    function getTokenInfo(
        uint16 tokenId
    ) external view returns (TokenInfo memory);

    function getNativeTokenWalletAddress() external view returns (address);
}
