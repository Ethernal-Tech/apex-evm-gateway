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
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external payable;

    function depositEvent(bytes calldata data) external;

    function withdrawEvent(
        uint8 destinationChainId,
        address sender,
        ReceiverWithdraw[] calldata receivers,
        uint256 feeAmount,
        uint256 value
    ) external;

    function ttlEvent(bytes calldata data) external;
}
