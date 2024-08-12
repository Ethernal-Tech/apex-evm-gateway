// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

    struct Deposits {
        uint64 batchId;
        uint64 ttlExpired;
        ReceiverDeposit[] _receivers;
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
    event Withdraw(
        uint8 destinationChainId,
        address sender,
        ReceiverWithdraw[] receivers,
        uint256 feeAmount
    );
    event TTLExpired(bytes data);

    error NotOwner();
    error NotRelayer();
    error NotGateway();
    error NotPredicate();
    error NotPredicateOrOwner();
    error ExceedsMaxLength();
    error InvalidReceiver();
    error InvalidSignature();
    error ZeroAddress();
    error InvalidData(string data);
    error BurnFailed();
    error InsufficientAllowance();
    error PrecompileCallFailed();
    error DecresedAllowenceBelowZero();
    error BatchAlreadyExecuted();
    error ValidatorNotRegistered();
}
