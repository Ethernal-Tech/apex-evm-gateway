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
        uint256 feeAmount;
        ReceiverDeposit[] receivers;
    }

    struct ReceiverWithdrawal {
        string receiver;
        uint256 amount;
    }

    struct ReceiverDeposit {
        address receiver;
        uint256 amount;
    }

    struct Withdrawals {
        uint8 destinationChainId;
        address sender;
        ReceiverWithdrawal[] receivers;
        uint256 feeAmount;
    }

    event Deposit(bytes data);

    event Withdraw(
        uint8 destinationChainId,
        address sender,
        ReceiverWithdrawal[] receivers,
        uint256 feeAmount
    );

    event TTLExpired(bytes data);

    error NotGateway();
    error NotPredicate();
    error NotPredicateOrOwner();
    error ExceedsMaxLength();
    error InvalidSignature();
    error ZeroAddress();
    error InvalidData(string data);
    error InsufficientAllowance();
    error PrecompileCallFailed();
    error DecresedAllowenceBelowZero();
    error BatchAlreadyExecuted();
}
