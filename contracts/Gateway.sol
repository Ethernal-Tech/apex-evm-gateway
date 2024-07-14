// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./interfaces/IStateSender.sol";
import "./interfaces/IStateReceiver.sol";
import "./ERC20TokenPredicate.sol";
import "./Validators.sol";

contract Gateway is IGateway {
    ERC20TokenPredicate private eRC20TokenPredicate;
    RegisteredToken[] public registeredTokens;
    Validators private validators;
    uint256 public constant MAX_LENGTH = 2048;
    address private relayer;
    address private owner;

    //TODO: make upgradable
    constructor() {
        owner = msg.sender;
    }

    function deposit(bytes[] calldata data) external onlyRelayer {
        //TO DO: validate signatures precompile
        uint256 dataLength = data.length;
        for (uint i; i < dataLength; i++)
            eRC20TokenPredicate.onStateReceive(data[i]);
    }

    function withdraw(
        IERC20Token token,
        uint8 destinationTokenId,
        string calldata receiver,
        uint256 amount
    ) external {
        eRC20TokenPredicate.withdraw(
            token,
            destinationTokenId,
            receiver,
            amount
        );
    }

    function syncState(bytes calldata data) external {
        // check receiver
        if (msg.sender == relayer) revert InvalidReceiver();
        // check data length
        if (data.length > MAX_LENGTH) revert ExceedsMaxLength();

        emit StateChange(data);
    }

    function setValidatorsChainData(
        ValidatorAddressChainData[] calldata _chainDatas
    ) external onlyOwner {
        validators.setValidatorsChainData(_chainDatas);
    }

    function addValidatorChainData(
        address _addr,
        ValidatorChainData calldata _data
    ) external onlyOwner {
        validators.addValidatorChainData(_addr, _data);
    }

    modifier onlyRelayer() {
        if (msg.sender == relayer) revert NotRelayer();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender == owner) revert NotOwner();
        _;
    }
}
