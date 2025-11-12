// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {INativeTokenWallet} from "./interfaces/INativeTokenWallet.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";
import {MyToken} from "./tokens/MyToken.sol";
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

    address public predicate;

    /// mapping tokenId to bool indicating token is LockUnlock token
    mapping(uint256 => bool) public isLockUnlockToken;

    /// mapping tokenId to token address
    mapping(uint256 => address) public tokenAddress;

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

    function setDependencies(address _predicate) external onlyOwner {
        if (_predicate == address(0)) revert ZeroAddress();
        predicate = _predicate;
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
        uint256 _tokenId
    ) external onlyPredicateOrOwner {
        if (_tokenId == 0) {
            (bool success, ) = _account.call{value: _amount}("");

            // Revert the transaction if the transfer fails
            if (!success) revert TransferFailed();
        } else if (isLockUnlockToken[_tokenId]) {
            IERC20 token = IERC20(tokenAddress[_tokenId]);
            token.safeTransferFrom(_account, address(this), _amount);
        } else {
            MyToken token = MyToken(tokenAddress[_tokenId]);
            token.mint(_account, _amount);
        }
    }

    function withdraw(
        ReceiverWithdraw[] calldata _receivers,
        uint256 _tokenId
    ) external override onlyPredicate {
        if (isLockUnlockToken[_tokenId]) {
            IERC20 token = IERC20(tokenAddress[_tokenId]);
            uint256 receiversLength = _receivers.length;
            for (uint256 i; i < receiversLength; i++) {
                token.safeTransfer(
                    _stringToAddress(_receivers[i].receiver),
                    _receivers[i].amount
                );
            }
        } else {
            MyToken token = MyToken(tokenAddress[_tokenId]);
            token.burn(
                _stringToAddress(_receivers[0].receiver),
                _receivers[0].amount
            );
        }
    }

    function setTokenAsLockUnlockToken(uint256 tokenId) external onlyPredicate {
        isLockUnlockToken[tokenId] = true;
    }

    function setTokenAddress(
        uint256 _tokenId,
        address _tokenAddress
    ) external onlyPredicate {
        if (isLockUnlockToken[_tokenId])
            revert TokenAddressAlreadyRegistered(_tokenAddress);
        tokenAddress[_tokenId] = _tokenAddress;
    }

    receive() external payable {}

    function version() public pure returns (string memory) {
        return "1.1.0";
    }

    modifier onlyPredicateOrOwner() {
        if (msg.sender != predicate && msg.sender != owner())
            revert NotPredicateOrOwner();

        _;
    }

    modifier onlyPredicate() {
        if (msg.sender != predicate) revert NotPredicate();
        _;
    }
}
