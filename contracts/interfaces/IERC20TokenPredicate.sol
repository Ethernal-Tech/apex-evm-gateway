// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IGatewayStructs.sol";

interface IERC20TokenPredicate is IGatewayStructs {
    function deposit(bytes calldata data) external;

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external;
}
