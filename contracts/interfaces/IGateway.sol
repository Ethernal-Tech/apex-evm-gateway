// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGatewayStructs} from "./IGatewayStructs.sol";

interface IGateway is IGatewayStructs {
    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data,
        uint256 coloredCoinId
    ) external;

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount,
        uint256 _coloredCoinId
    ) external payable;

    function updateValidatorsChainData(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external;
}
