// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IStateSender {
    function syncState(bytes calldata data) external;
}
