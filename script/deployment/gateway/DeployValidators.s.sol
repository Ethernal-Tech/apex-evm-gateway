// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../../../lib/forge-std/src/Script.sol";

import {Validators} from "../../../contracts/Validators.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract ValidatorsDeployer is Script{
    function deployValidators(address[] memory validators) internal returns (address logicAddr, address proxyAddr){
        vm.startBroadcast();

        // Deploy the implementation 
        Validators validatorsImplementation = new Validators();

        bytes memory data = abi.encodeCall(
            Validators.initialize,
            (validators)
        );

        // Deploy the proxy with the implementation address and initialization
        ERC1967Proxy proxy = new ERC1967Proxy(address(validatorsImplementation), data);


        vm.stopBroadcast();

        logicAddr = address(validatorsImplementation);
        proxyAddr = address(proxy);
    }
}

contract DeployValidators is ValidatorsDeployer{
    function run(address[] calldata validators) external returns (address logicAddr, address proxyAddr){
        return deployValidators(validators);
    }
}