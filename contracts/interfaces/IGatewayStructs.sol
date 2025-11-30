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
        uint16 tokenId;
    }

    struct ReceiverWithdraw {
        string receiver;
        uint256 amount;
        uint16 tokenId;
    }

    event Deposit(bytes data);
    event DepositedToken(bytes data);
    event FundsDeposited(address indexed sender, uint256 value);
    event MinAmountsUpdated(
        uint256 minFee,
        uint256 minAmount,
        uint256 minOperationFee
    );
    event TokenRegistered(
        string name,
        string symbol,
        uint16 tokenId,
        address contractAddress,
        bool isLockUnlockToken
    );
    event TTLExpired(bytes data);
    event ValidatorSetUpdatedGW(bytes data);
    event ValidatorsSetUpdated(bytes data);
    event Withdraw(
        uint8 destinationChainId,
        address sender,
        ReceiverWithdraw[] receivers,
        uint256 fee,
        uint256 operationFee,
        uint256 value
    );
    event WithdrawToken(
        address sender,
        string indexed receiver,
        uint256 amount
    );

    error BatchAlreadyExecuted();
    error InsufficientFee(uint256 minFeeAmount, uint256 feeAmount);
    error InvalidBridgingAmount(
        uint256 minBridgingAmount,
        uint256 bridgingAmount
    );
    error InvalidSignature();
    error NotContractAddress(address addr);
    error NotGateway();
    error NotPredicate();
    error TokenAddressAlreadyRegistered(address addr);
    error TokenIdAlreadyRegistered(uint16 tokenId);
    error TokenNotRegistered(uint16 tokenId);
    error TransferFailed();
    error WrongValidatorsSetValue();
    error WrongValue(uint256 expected, uint256 received);
    error ZeroTokenId();
}
