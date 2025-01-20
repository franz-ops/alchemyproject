//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./IPricingCurve.sol";

contract ConstantProductCurve is IPricingCurve {
    function getOutputAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve,
        uint256 fee
    ) external pure override returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "Invalid reserves");
        uint256 inputAmountWithFee = inputAmount * (1000 - fee) / 1000;
        return (outputReserve * inputAmountWithFee) / (inputReserve + inputAmountWithFee);
    }

    function getLPTokensAmount(
    uint256 amountA,
    uint256 amountB,
    uint256 totalSupply,
    uint256 reserveA,
    uint256 reserveB
    ) external pure override returns (uint256) {

        if (reserveA == 0 && reserveB == 0) {
            return sqrt(amountA * amountB);
        } else {
            // Calculate the proportion of the reserves to withdraw based on x * y = k
            uint256 proportionA = (amountA * totalSupply) / reserveA;
            uint256 proportionB = (amountB * totalSupply) / reserveB;
            
            // Returns the minimum of the two proportions
            return min(proportionA, proportionB);
        }
    }
    
    // Utility function to find the minimum of two values
    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }

    // Utility function to calculate square root
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
