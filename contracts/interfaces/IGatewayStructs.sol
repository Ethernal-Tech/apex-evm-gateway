// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGatewayStructs {
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

    struct ReceiverDeposit {
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
        uint256 feeAmount,
        uint256 value
    );

    event TTLExpired(bytes data);
    event FundsDeposited(address indexed sender, uint256 value);
    event ValidatorsSetUpdated(bytes data);
    event FeeAmountUpdated(uint256 fee);

    error NotGateway();
    error NotPredicate();
    error NotPredicateOrOwner();
    error InvalidSignature();
    error ZeroAddress();
    error WrongValue(uint256 expected, uint256 received);
    error BatchAlreadyExecuted();
    error TransferFailed();
    error WrongValidatorsSetValue();
    error WrongFeeAmount(uint256 feeAmount, uint256 _feeAmount);
    error BridgingZeroAmount();
}
