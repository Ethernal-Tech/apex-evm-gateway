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

    struct ValidatorSetChange {
        uint64 batchId;
        uint256 _validatorsSetNumber;
        uint256 _ttl;
        ValidatorChainData[] _validatorsChainData;
    }

    struct ReceiverDeposit {
        address receiver;
        uint256 amount;
    }

    struct ReceiverWithdraw {
        string receiver;
        uint256 amount;
    }

    event Deposit(bytes data, uint256 tokenId);
    event DepositedToken(bytes data);
    event Withdraw(
        uint8 destinationChainId,
        address sender,
        ReceiverWithdraw[] receivers,
        uint256 feeAmount,
        uint256 value,
        uint256 tokenId
    );
    event WithdrawToken(
        address sender,
        string indexed receiver,
        uint256 amount
    );
    event TTLExpired(bytes data);
    event FundsDeposited(address indexed sender, uint256 value);
    event ValidatorsSetUpdated(bytes data);
    event MinAmountsUpdated(uint256 minFee, uint256 minAmount);
    event ValidatorSetUpdatedGW(bytes data);
    event TokenRegistered(
        string name,
        string symbol,
        uint256 tokenId,
        address contractAddress,
        bool isLockUnlockToken
    );

    error NotGateway();
    error NotPredicate();
    error NotPredicateOrOwner();
    error InvalidSignature();
    error ZeroAddress();
    error WrongValue(uint256 expected, uint256 received);
    error BatchAlreadyExecuted();
    error TransferFailed();
    error WrongValidatorsSetValue();
    error InsufficientFeeAmount(uint256 minFeeAmount, uint256 feeAmount);
    error InvalidBridgingAmount(
        uint256 minBridgingAmount,
        uint256 bridgingAmount
    );
    error NotContractAddress(address addr);
    error TokenNotRegistered(uint256 tokenId);
    error TokenAddressAlreadyRegistered(address addr);
    error InvalidNumberOfBurnOrLockAddresses(uint256 length);
    error InvalidBurnOrLockAddress(string addr);
}
