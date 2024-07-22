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

    error NotRelayer();
    error NotGateway();
    error NotPredicate();
    error NotPredicateOrOwner();
    error NotGatewayOrOwner();
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
