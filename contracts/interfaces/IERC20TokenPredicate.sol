// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IStateReceiver.sol";
import "./IERC20Token.sol";
import "./IGatewayStructs.sol";

interface IERC20TokenPredicate is IGatewayStructs, IStateReceiver {
    // function onStateReceive(
    //     uint256 /* id */,
    //     address sender,
    //     bytes calldata data
    // ) external;

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external;
}
