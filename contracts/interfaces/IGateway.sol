// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IGatewayStructs.sol";

interface IGateway is IGatewayStructs {
    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external;

    function withdraw(
        Withdrawals calldata _withdrawals,
        bytes calldata _signature
    ) external;

    function depositEvent(bytes calldata data) external;

    function withdrawEvent(
        uint8 destinationChainId,
        address sender,
        ReceiverWithdrawal[] calldata receivers,
        uint256 feeAmount
    ) external;

    function ttlEvent(bytes calldata data) external;
}
