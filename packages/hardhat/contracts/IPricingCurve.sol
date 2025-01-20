//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IPricingCurve {
    function getOutputAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve,
        uint256 fee
    ) external view returns (uint256);

    function getLPTokensAmount(
        uint256 amountA,
        uint256 amountB,
        uint256 totalSupply,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (uint256);
}
