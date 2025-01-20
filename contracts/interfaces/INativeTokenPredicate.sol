// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IGatewayStructs.sol";

interface INativeTokenPredicate is IGatewayStructs {
    function deposit(
        bytes calldata data,
        address relayer
    ) external returns (bool);
}
