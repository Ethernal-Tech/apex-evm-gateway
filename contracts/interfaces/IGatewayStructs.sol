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
        uint256 tokenId;
    }

    struct ReceiverWithdraw {
        string receiver;
        uint256 amount;
        uint256 tokenId;
    }

    event Deposit(bytes data);
    event DepositedToken(bytes data);
    event FundsDeposited(address indexed sender, uint256 value);
    event MinAmountsUpdated(uint256 minFee, uint256 minAmount);
    event TokenRegistered(
        string name,
        string symbol,
        uint256 tokenId,
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
        uint256 feeAmount,
        uint256 value
    );
    event WithdrawToken(
        address sender,
        string indexed receiver,
        uint256 amount
    );

    error BatchAlreadyExecuted();
    error InsufficientFeeAmount(uint256 minFeeAmount, uint256 feeAmount);
    error InvalidBridgingAmount(
        uint256 minBridgingAmount,
        uint256 bridgingAmount
    );
    error InvalidBurnOrLockAddress(string addr);
    error InvalidSignature();
    error NotContractAddress(address addr);
    error NotGateway();
    error NotPredicate();
    error TokenAddressAlreadyRegistered(address addr);
    error TokenIdAlreadyRegistered(uint256 tokenId);
    error TokenNotRegistered(uint256 tokenId);
    error TransferFailed();
    error WrongValidatorsSetValue();
    error WrongValue(uint256 expected, uint256 received);
    error ZeroTokenId();
}
