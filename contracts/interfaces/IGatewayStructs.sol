// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IStateSender.sol";
import "./IERC20Token.sol";

interface IGatewayStructs {
    struct ValidatorAddressChainData {
        address addr;
        ValidatorChainData data;
    }

    struct ValidatorChainData {
        // verifying key, verifying Fee key for Cardano
        // BLS for EVM
        uint256[4] key;
    }

    event StateChange(bytes data);

    error NotRelayer();
    error NotGateway();
    error NotOwner();
    error InvalidReceiver();
    error ExceedsMaxLength();
    error InvalidData(string data);
}
