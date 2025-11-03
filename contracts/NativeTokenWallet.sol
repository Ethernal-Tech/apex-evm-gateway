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

/**
 * @title NativeTokenWallet
 * @notice A wallet contract to manage native token deposits and interactions.
 * @dev Supports upgradeability using OpenZeppelin's UUPS module and adheres to IGatewayStructs and INativeTokenWallet interfaces.
 */
contract NativeTokenWallet is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IGatewayStructs,
    INativeTokenWallet
{
    using SafeERC20 for IERC20;

    address public predicate;

    /// mapping coloredCoinId to bool indicating if the colored coin is registered
    mapping(uint256 => bool) public isLayerZeroToken;

    mapping(uint256 => address) public coloredCoinAddress;

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
        uint256 _coloredCoinId
    ) external onlyPredicateOrOwner {
        if (_coloredCoinId == 0) {
            (bool success, ) = _account.call{value: _amount}("");

            // Revert the transaction if the transfer fails
            if (!success) revert TransferFailed();
        } else if (isLayerZeroToken[_coloredCoinId]) {
            IERC20 coloredCoin = IERC20(coloredCoinAddress[_coloredCoinId]);
            coloredCoin.safeTransfer(_account, _amount);
        } else {
            MyToken coloredCoin = MyToken(coloredCoinAddress[_coloredCoinId]);
            coloredCoin.mint(_account, _amount);
        }
    }

    function withdraw(
        ReceiverWithdraw[] calldata _receivers,
        uint256 _coloredCoinId
    ) external override onlyPredicate {
        if (isLayerZeroToken[_coloredCoinId]) {
            IERC20 coloredCoin = IERC20(coloredCoinAddress[_coloredCoinId]);
            uint256 receiversLength = _receivers.length;
            for (uint256 i; i < receiversLength; i++) {
                coloredCoin.safeTransfer(
                    _stringToAddress(_receivers[i].receiver),
                    _receivers[i].amount
                );
            }
        } else {
            MyToken coloredCoin = MyToken(coloredCoinAddress[_coloredCoinId]);
            uint256 receiversLength = _receivers.length;
            for (uint256 i; i < receiversLength; i++) {
                coloredCoin.burn(
                    _stringToAddress(_receivers[i].receiver),
                    _receivers[i].amount
                );
            }
        }
    }

    function _stringToAddress(string memory s) internal pure returns (address) {
        bytes memory b = bytes(s);
        require(b.length == 42, "Invalid address length"); // "0x" + 40 hex chars
        uint160 result = 0;
        for (uint i = 2; i < 42; i++) {
            result *= 16;
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57)
                result += c - 48; // 0-9
            else if (c >= 65 && c <= 70)
                result += c - 55; // A-F
            else if (c >= 97 && c <= 102)
                result += c - 87; // a-f
            else revert("Invalid hex character");
        }
        return address(result);
    }

    function setColoredCoinAsLayerZeroToken(
        uint256 coloredCoinId
    ) external onlyPredicate {
        isLayerZeroToken[coloredCoinId] = true;
    }

    function setColoredCoinAddress(
        uint256 _coloredCoinId,
        address _coloredCoinAddress
    ) external onlyPredicate {
        coloredCoinAddress[_coloredCoinId] = _coloredCoinAddress;
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
