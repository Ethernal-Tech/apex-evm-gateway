// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IGatewayStructs.sol";

interface IERC20TokenPredicate is IGatewayStructs {
    function deposit(bytes calldata data, address relayer) external;

    function withdraw(
        Withdrawals calldata _withdrawals,
        bytes calldata _signature,
        address _caller
    ) external;
}
