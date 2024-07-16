// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IStateSender.sol";
import "./IERC20Token.sol";
import "./IGatewayStructs.sol";

interface IGateway is IStateSender, IGatewayStructs {
    function deposit(
        bytes calldata _signature,
        bytes calldata _bitmap,
        bytes calldata _data
    ) external;

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external;
}
