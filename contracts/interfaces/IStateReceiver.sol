// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IStateReceiver {
    function onStateReceive(bytes calldata data) external;
}
