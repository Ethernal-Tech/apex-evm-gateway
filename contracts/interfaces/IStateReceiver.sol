// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IStateReceiver {
    function deposit(bytes calldata data) external;
}
