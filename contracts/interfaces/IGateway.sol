// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IStateSender.sol";
import "./IERC20Token.sol";
import "./IGatewayStructs.sol";

interface IGateway is IStateSender, IGatewayStructs {
    function deposit(bytes[] calldata data) external;

    function withdraw(
        IERC20Token token,
        uint8 destinationTokenId,
        string calldata receiver,
        uint256 amount
    ) external;
}
