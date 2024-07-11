// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IStateReceiver.sol";
import "./IERC20Token.sol";

interface IERC20TokenPredicate is IStateReceiver {
    function initialize(
        address newGataway,
        address newRootERC20Predicate,
        address newChildTokenTemplate,
        address newNativeTokenRootAddress
    ) external;

    // function onStateReceive(
    //     uint256 /* id */,
    //     address sender,
    //     bytes calldata data
    // ) external;

    function withdraw(IERC20Token childToken, uint256 amount) external;

    function withdrawTo(
        IERC20Token childToken,
        address receiver,
        uint256 amount
    ) external;
}
