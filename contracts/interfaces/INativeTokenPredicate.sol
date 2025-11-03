// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGatewayStructs} from "./IGatewayStructs.sol";

interface INativeTokenPredicate is IGatewayStructs {
    function deposit(
        bytes calldata data,
        address relayer,
        uint256 coloredCoinId
    ) external returns (bool);

    function resetBatchId() external;
}
