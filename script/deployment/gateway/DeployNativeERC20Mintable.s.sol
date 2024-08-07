// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../../../lib/forge-std/src/Script.sol";

import {NativeERC20Mintable} from "../../../contracts/NativeERC20Mintable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract NativeERC20MintableDeployer is Script{
    function deployNativeERC20Mintable() internal returns (address logicAddr, address proxyAddr){
        vm.startBroadcast();

        // Deploy the implementation 
        NativeERC20Mintable nativeERC20MintableImplementation = new NativeERC20Mintable();

        bytes memory data = abi.encodeWithSignature("initialize()");

        // Deploy the proxy with the implementation address and initialization
        ERC1967Proxy proxy = new ERC1967Proxy(address(nativeERC20MintableImplementation), data);

        vm.stopBroadcast();

        logicAddr = address(nativeERC20MintableImplementation);
        proxyAddr = address(proxy);
    }
}

contract DeployNativeERC20Mintable is NativeERC20MintableDeployer{
    function run() external returns (address logicAddr, address proxyAddr){
        return deployNativeERC20Mintable();
    }
}