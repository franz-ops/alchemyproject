// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "hardhat/console.sol";

contract MultiSwapExecutor {
    struct SwapData {
        address token;       // Indirizzo del token da scambiare
        address pool;        // Indirizzo del pool di destinazione
        uint256 amount;      // Quantità di token da scambiare
        uint256 deadline;    // Scadenza della firma
        uint8 v;             // Parte della firma
        bytes32 r;           // Parte della firma
        bytes32 s;           // Parte della firma
    }

    function executeBatchSwapWithPermit(SwapData[] calldata swaps) external {
        for (uint256 i = 0; i < swaps.length; i++) {
            // Step 1: Authorizing the MultiSwapExecutor to spend the user's tokens using off-chain signatures
            IERC20Permit(swaps[i].token).permit(
                msg.sender,          // L'utente che firma
                swaps[i].pool,       // MultiSwapExecutor come spender
                swaps[i].amount,     // Importo autorizzato
                swaps[i].deadline,   // Scadenza della firma
                swaps[i].v, 
                swaps[i].r, 
                swaps[i].s
            );

            //console.log("weth balance: ", LiquidityPool(payable(swaps[i].pool)).tokenA_balance());

            // Step 3: Interagire con il pool per eseguire lo swap
            _swap(swaps[i].token, swaps[i].pool, swaps[i].amount);
        }
    }

    function _swap(
        address token,
        address pool,
        uint256 amount
    ) internal {
        //uint256 allowance = IERC20(token).allowance(msg.sender, pool);
        //console.log("allowance: ", allowance);
        LiquidityPool(payable(pool)).swap(token, amount, msg.sender);
    }
}
