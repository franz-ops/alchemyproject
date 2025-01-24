// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "hardhat/console.sol";

contract MultiSwapExecutor {
    struct SwapData {
        address token;       // Address of the token to swap
        address pool;        // Address of the pool to swap with
        uint256 amount;      // Amount of tokens to swap
        uint256 deadline;    // Deadline for the permit
        uint8 v;             // v part of the signature
        bytes32 r;           // r part of the signature
        bytes32 s;           // s part of the signature
    }

    function executeBatchSwapWithPermit(SwapData[] calldata swaps) external {

        for (uint256 i = 0; i < swaps.length; i++) {

            // Step 1: Authorizing the MultiSwapExecutor to spend the user's tokens using off-chain signatures
            IERC20Permit(swaps[i].token).permit(
                msg.sender,          // owner
                swaps[i].pool,       // spender
                swaps[i].amount,     // amount
                swaps[i].deadline,   // deadline
                swaps[i].v, 
                swaps[i].r, 
                swaps[i].s
            );

            _swap(swaps[i].token, swaps[i].pool, swaps[i].amount);
        }
    }

    function _swap(
        address token,
        address pool,
        uint256 amount
    ) internal {
        LiquidityPool(payable(pool)).swap(token, amount, msg.sender);
    }
}
