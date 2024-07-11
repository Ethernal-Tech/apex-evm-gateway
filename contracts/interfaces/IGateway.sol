// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IStateSender.sol";

interface IGateway is IStateSender {
    struct RegisteredToken {
        address tokenAddress;
        uint8 id;
    }

    struct Receiver {
        uint256 amount;
        string destinationAddress;
    }

    function deposit(
        address _tokenAddress,
        Receiver[] calldata receivers
    ) external view;

    function withdraw() external view;
}
