// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "./MyToken.sol";
import "hardhat/console.sol";

/**
 * @title TokenFactory
 * @dev Upgradeable factory for deploying upgradeable ERC20 tokens
 */
contract TokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    ProxyAdmin public proxyAdmin;

    address public gatewayAddress;

    address public implementation; // base ERC20 implementation used for proxies

    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the factory (called once)
    function initialize(
        address _implementation,
        address _gatewayAddress
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        proxyAdmin = new ProxyAdmin(msg.sender);
        gatewayAddress = _gatewayAddress;
        implementation = _implementation;
    }

    /// @notice Authorize upgrades (only owner)
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /// @notice Creates a new upgradeable ERC20 token proxy
    function createToken(
        string memory _name,
        string memory _symbol
    ) external onlyGateway returns (address _contractAddress) {
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            implementation,
            address(proxyAdmin),
            ""
        );

        MyToken(address(proxy)).initialize(_name, _symbol);

        return address(proxy);
    }

    modifier onlyGateway() {
        if (msg.sender != gatewayAddress) revert NotGateway();
        _;
    }
    error NotGateway();
}
