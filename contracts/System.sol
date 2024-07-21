// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract System {
    // pre-compiled contracts
    // slither-disable too-many-digits
    address public constant NATIVE_TRANSFER_PRECOMPILE =
        0x0000000000000000000000000000000000002020;
    address public constant VALIDATOR_BLS_PRECOMPILE =
        0x0000000000000000000000000000000000002060;

    // pre-compiled gas consumption
    uint256 public constant NATIVE_TRANSFER_PRECOMPILE_GAS = 21000;
    uint256 public constant VALIDATOR_BLS_PRECOMPILE_GAS = 50000;

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
