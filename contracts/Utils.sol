// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Utils
/// @notice Utility functions for contract operations.
contract Utils {
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
}
