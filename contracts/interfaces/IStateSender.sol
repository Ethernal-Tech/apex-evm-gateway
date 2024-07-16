// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IStateSender {
    function depositEvent(bytes calldata data) external;

    function withdrawEvent(bytes calldata data) external;

    function ttlEvent(bytes calldata data) external;
}
