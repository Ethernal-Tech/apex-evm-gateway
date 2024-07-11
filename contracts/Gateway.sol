// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./interfaces/IGateway.sol";
import "./interfaces/IStateSender.sol";
import "./interfaces/IStateReceiver.sol";
import "./ERC20TokenPredicate.sol";

contract Gateway is IGateway {
    ERC20TokenPredicate private eRC20TokenPredicate;
    RegisteredToken[] public registeredTokens;

    function deposit(
        address _tokenAddress,
        Receiver[] calldata receivers
    ) external view override {
        // some logic
    }

    function withdraw() external view override {
        // some logic
    }

    function syncState(
        address receiver,
        bytes calldata data
    ) external override {}
}
