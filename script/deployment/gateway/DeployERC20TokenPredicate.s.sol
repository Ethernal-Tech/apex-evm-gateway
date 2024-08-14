// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../../../lib/forge-std/src/Script.sol";

import {ERC20TokenPredicate} from "../../../contracts/ERC20TokenPredicate.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract ERC20TokenPredicateDeployer is Script {
    function deployERC20TokenPredicate() internal returns (address logicAddr, address proxyAddr){
        vm.startBroadcast();

        // Deploy the implementation 
        ERC20TokenPredicate erc20PredicateImplementation = new ERC20TokenPredicate();

        bytes memory data = abi.encodeWithSignature("initialize()");

        // Deploy the proxy with the implementation address and initialization
        ERC1967Proxy proxy = new ERC1967Proxy(address(erc20PredicateImplementation), data);

        vm.stopBroadcast();

        logicAddr = address(erc20PredicateImplementation);
        proxyAddr = address(proxy);
    }
}

contract DeployERC20TokenPredicate is ERC20TokenPredicateDeployer {
    function run() external returns (address logicAddr, address proxyAddr){
        return deployERC20TokenPredicate();
    }
}

