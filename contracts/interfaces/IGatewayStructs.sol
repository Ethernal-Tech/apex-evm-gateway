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

    struct ReceiverDeposit {
        uint8 sourceChainId;
        address receiver;
        uint256 amount;
    }

    struct ReceiverWithdraw {
        string receiver;
        uint256 amount;
    }

    event Deposit(bytes data);
    event Withdraw(bytes data);
    event TTLExpired(bytes data);

    error NotOwner();
    error NotRelayer();
    error NotGateway();
    error NotPredicate();
    error ExceedsMaxLength();
    error InvalidReceiver();
    error InvalidSignature();
    error InvalidData(string data);
}