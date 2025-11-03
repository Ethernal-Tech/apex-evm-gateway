// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import "./MyToken.sol";

/**
 * @title TokenFactory
 * @dev Upgradeable factory for deploying upgradeable ERC20 tokens
 */
contract TokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    ProxyAdmin public proxyAdmin;

    mapping(string => address) public tokenAddressByName;
    address[] public allTokenAddresses;

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
        string memory _symbol,
        uint256 _coloredCoinId
    ) external onlyGateway {
        require(
            tokenAddressByName[_name] == address(0),
            "Token name already exists"
        );

        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            implementation,
            address(proxyAdmin),
            ""
        );

        MyToken(address(proxy)).initialize(_name, _symbol, msg.sender);

        tokenAddressByName[_name] = address(proxy);
        allTokenAddresses.push(address(proxy));

        emit TokenCreated(_name, _symbol, _coloredCoinId, address(proxy));
    }

    /// @notice View all deployed tokens
    function getAllTokens() external view returns (address[] memory) {
        return allTokenAddresses;
    }

    modifier onlyGateway() {
        if (msg.sender != gatewayAddress) revert NotGateway();
        _;
    }

    event TokenCreated(
        string name,
        string symbol,
        uint256 coloredCoinId,
        address tokenProxy
    );
    error NotGateway();
}
