// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {INativeTokenWallet} from "./interfaces/INativeTokenWallet.sol";
import {MyToken} from "./tokens/MyToken.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";
import {Utils} from "./Utils.sol";

/**
 * @title NativeTokenWallet
 * @notice A wallet contract to manage native token deposits and interactions.
 * @dev Supports upgradeability using OpenZeppelin's UUPS module and adheres to IGatewayStructs and INativeTokenWallet interfaces.
 */
contract NativeTokenWallet is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    Utils,
    IGatewayStructs,
    INativeTokenWallet
{
    using SafeERC20 for IERC20;

    address public predicateAddress;

    /// mapping tokenId to bool indicating token is LockUnlock token
    mapping(uint16 => bool) public isLockUnlockToken;

    /// mapping tokenId to token address
    mapping(uint16 => address) public tokenAddress;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setDependencies(address _predicateAddress) external onlyOwner {
        if (!_isContract(_predicateAddress))
            revert NotContractAddress(_predicateAddress);
        predicateAddress = _predicateAddress;
    }

    /**
     * @notice Deposits an amount of native tokens to a specific account.
     * @param _account The address of the account to deposit tokens to.
     * @param _amount The amount of tokens to deposit.
     * @dev Can only be called by the predicate contract or the contract owner.
     * Reverts if the transfer fails.
     */
    function deposit(
        address _account,
        uint256 _amount,
        uint16 _tokenId,
        bool isCurrencyToken
    ) external onlyPredicate {
        if (isCurrencyToken) {
            (bool success, ) = _account.call{value: _amount}("");
            // Revert the transaction if the transfer fails
            if (!success) revert TransferFailed();
        } else if (isLockUnlockToken[_tokenId]) {
            IERC20 token = IERC20(tokenAddress[_tokenId]);
            token.safeTransfer(_account, _amount);
        } else {
            MyToken token = MyToken(tokenAddress[_tokenId]);
            token.mint(_account, _amount);
        }
    }

    /// @notice Processes withdrawals of tokens to one or more receivers based on the token type.
    /// @dev
    /// - If the token is a registered Lock/Unlock token, tokens are transferred directly to each receiver.
    /// - If the token is a native bridged token (non-Lock/Unlock), the tokens are burned from the sender’s balance.
    /// - This function can only be called by the predicate contract authorized to manage withdrawals.
    /// @param _receiver ReceiverWithdraw struct containing receiver details.
    /// @custom:modifier onlyPredicate Restricts the call to the authorized predicate contract.
    /// @custom:reverts None Explicitly, but will revert if token transfer or burn fails.
    /// @custom:security Consider verifying receiver addresses before transfer to avoid accidental burns or misdirected transfers.
    function withdraw(
        address _sender,
        ReceiverWithdraw calldata _receiver
    ) external override onlyPredicate {
        uint16 _tokenId = _receiver.tokenId;
        if (isLockUnlockToken[_tokenId]) {
            IERC20 token = IERC20(tokenAddress[_tokenId]);

            token.safeTransferFrom(_sender, address(this), _receiver.amount);
        } else {
            MyToken token = MyToken(tokenAddress[_tokenId]);
            token.burn(_sender, _receiver.amount);
        }
    }

    function setTokenAsLockUnlockToken(uint16 tokenId) external onlyPredicate {
        isLockUnlockToken[tokenId] = true;
    }

    function setTokenAddress(
        uint16 _tokenId,
        address _tokenAddress
    ) external onlyPredicate {
        tokenAddress[_tokenId] = _tokenAddress;
    }

    receive() external payable {}

    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyPredicate() {
        if (msg.sender != predicateAddress) revert NotPredicate();
        _;
    }
}
