// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IERC1155Token.sol";
import "./IStateReceiver.sol";

interface IERC1155TokenPredicate is IStateReceiver {
    function initialize(
        address newL2StateSender,
        address newStateReceiver,
        address newRootERC721Predicate,
        address newChildTokenTemplate
    ) external;

    // function onStateReceive(
    //     uint256 /* id */,
    //     // address sender,
    //     bytes calldata data
    // ) external;

    function withdraw(
        IERC1155Token childToken,
        uint256 tokenId,
        uint256 amount
    ) external;

    function withdrawTo(
        IERC1155Token childToken,
        address receiver,
        uint256 tokenId,
        uint256 amount
    ) external;
}
