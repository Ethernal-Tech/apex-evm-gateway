// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract OwnerToken is
    Initializable,
    ERC20Upgradeable,
    ERC20VotesUpgradeable,
    OwnableUpgradeable,
    ERC20PermitUpgradeable,
    UUPSUpgradeable
{
    address public ownerGovernor;

    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _recipient, address _owner) public initializer {
        __ERC20_init("OwnerToken", "OTK");
        __Ownable_init(_owner);
        __ERC20Permit_init("OwnerToken");
        __ERC20Votes_init(); // ✅ Must include this
        __UUPSUpgradeable_init();

        if (_owner == address(0) || _recipient == address(0)) {
            revert ZeroAddress();
        }

        _mint(_recipient, 5 * 10 ** decimals());
    }

    function setDependencies(
        address _ownerGovernor
    ) external reinitializer(2) onlyOwner {
        ownerGovernor = _ownerGovernor;
    }

    function mint(address to, uint256 amount) public onlyOwnerGovernor {
        _mint(to, amount);
    }

    // Required by Solidity to resolve multiple inheritance
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    )
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwnerGovernor {}

    modifier onlyOwnerGovernor() {
        if (msg.sender != ownerGovernor) revert NotOwnerGovernor();
        _;
    }

    error ZeroAddress();
    error NotOwnerGovernor();
}
