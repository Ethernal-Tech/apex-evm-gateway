// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../../../lib/forge-std/src/Script.sol";

import {Gateway} from "../../../contracts/Gateway.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract GatewayDeployer is Script{
    function deployGateway() internal returns (address logicAddr, address proxyAddr){
        vm.startBroadcast();

        // Deploy the implementation 
        Gateway gatewayImplementation = new Gateway();

        bytes memory data = abi.encodeWithSignature("initialize()");

        // Deploy the proxy with the implementation address and initialization
        ERC1967Proxy proxy = new ERC1967Proxy(address(gatewayImplementation), data);

        vm.stopBroadcast();

        logicAddr = address(gatewayImplementation);
        proxyAddr = address(proxy);
    }
}

contract DeployGateway is GatewayDeployer{
    function run() external returns (address logicAddr, address proxyAddr){
        return deployGateway();
    }
}