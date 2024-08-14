// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../../lib/forge-std/src/Script.sol";
import "../../lib/forge-std/src/console.sol";

import "../deployment/gateway/DeployERC20TokenPredicate.s.sol";
import "../deployment/gateway/DeployNativeERC20Mintable.s.sol";
import "../deployment/gateway/DeployGateway.s.sol";
import "../deployment/gateway/DeployValidators.s.sol";
import "../../contracts/interfaces/IGatewayStructs.sol";

contract DeployGatewayContracts is
    ERC20TokenPredicateDeployer,
    NativeERC20MintableDeployer,
    GatewayDeployer,
    ValidatorsDeployer,
    IGatewayStructs
{
    using stdJson for string;

    function run()
        external
        returns (
            address erc20TokenPredicateLogic,
            address erc20TokenPredicateProxy,
            address nativeERC20MintableLogic,
            address nativeERC20MintableProxy,
            address gatewayLogic,
            address gatewayProxy,
            address validatorsLogic,
            address validatorsProxy
        )
    {
        string memory config = vm.readFile(
            "script/deployment/validatorsConfig.json"
        );

        bytes memory rawAddresses = vm.parseJson(config, ".addresses");

        address[] memory validatorsAddresses = abi.decode(
            rawAddresses,
            (address[])
        );

        (
            erc20TokenPredicateLogic,
            erc20TokenPredicateProxy
        ) = deployERC20TokenPredicate();

        (
            nativeERC20MintableLogic,
            nativeERC20MintableProxy
        ) = deployNativeERC20Mintable();

        (gatewayLogic, gatewayProxy) = deployGateway();

        (validatorsLogic, validatorsProxy) = deployValidators(
            validatorsAddresses
        );

        //setting dependencies
        setDependenciesNativeERC20Mintable(
            config,
            nativeERC20MintableProxy,
            erc20TokenPredicateProxy
        );

        setDependenciesGateway(
            config,
            gatewayProxy,
            erc20TokenPredicateProxy,
            validatorsProxy
        );

        setDependenciesNativeERC20Mintable(
            config,
            nativeERC20MintableProxy,
            erc20TokenPredicateProxy
        );

        // setDependenciesValidators(config, validatorsProxy, gatewayProxy);
    }

    function setDependenciesNativeERC20Mintable(
        string memory config,
        address nativeERC20MintableProxy,
        address erc20TokenPredicateProxy
    ) internal {
        bytes memory rawName = vm.parseJson(
            config,
            ".NativeERC20Mintable.name"
        );

        bytes memory rawSymbol = vm.parseJson(
            config,
            ".NativeERC20Mintable.symbol"
        );

        bytes memory rawDecimals = vm.parseJson(
            config,
            ".NativeERC20Mintable.decimals"
        );

        bytes memory rawTokenSupply = vm.parseJson(
            config,
            ".NativeERC20Mintable.tokenSupply"
        );

        NativeERC20Mintable nativeERC20MintableContract = NativeERC20Mintable(
            address(nativeERC20MintableProxy)
        );

        nativeERC20MintableContract.setDependencies(
            erc20TokenPredicateProxy,
            config.readAddress(".NativeERC20Mintable.owner"),
            abi.decode(rawName, (string)),
            abi.decode(rawSymbol, (string)),
            abi.decode(rawDecimals, (uint8)),
            abi.decode(rawTokenSupply, (uint256))
        );
    }

    function setDependenciesGateway(
        string memory config,
        address gatewayProxy,
        address erc20TokenPredicateProxy,
        address validatorsProxy
    ) internal {
        Gateway gatewayContract = Gateway(address(gatewayProxy));

        gatewayContract.setDependencies(
            erc20TokenPredicateProxy,
            validatorsProxy,
            config.readAddress(".Gateway.relayer")
        );
    }

    function setDependenciesValidators(
        string memory config,
        address validatorsProxy,
        address gatewayProxy
    ) internal {
        Validators validatorsContract = Validators(address(validatorsProxy));
        bytes memory rawChainData = vm.parseJson(
            config,
            ".ValidatorAddressChainData"
        );
        ValidatorAddressChainData[] memory validatorsChainData = abi.decode(
            rawChainData,
            (ValidatorAddressChainData[])
        );
        validatorsContract.setDependencies(gatewayProxy, validatorsChainData);
    }

    function setDependenciesERC20TokenPredicate(
        address erc20TokenPredicateProxy,
        address gatewayProxy,
        address nativeERC20MintableProxy
    ) internal {
        ERC20TokenPredicate eRC20TokenPredicateContract = ERC20TokenPredicate(
            address(erc20TokenPredicateProxy)
        );

        eRC20TokenPredicateContract.setDependencies(
            gatewayProxy,
            nativeERC20MintableProxy
        );
    }
}
