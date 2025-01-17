//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Useful for debugging. Remove when deploying to a live network.
import "hardhat/console.sol";

// Use openzeppelin to inherit battle-tested implementations (ERC20, ERC721, etc)
// import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LiquidityPoolToken.sol";

/**
 * A smart contract that allows changing a state variable of the contract and tracking the changes
 * It also allows the owner to withdraw the Ether in the contract
 * @author franz-ops
 */
contract LiquidityPool {
    // State Variables
    address public immutable owner;
    IERC20 public tokenA;
    IERC20 public tokenB;

    uint256 public tokenA_balance;
    uint256 public tokenB_balance;
    uint256 public constant fee = 3;

    LiquidityPoolToken public lpToken;

    // Constructor: Called once on contract deployment
    // Check packages/hardhat/deploy/00_deploy_your_contract.ts
    constructor(address _tokenA, address _tokenB, string memory tokenA_symbol, string memory tokenB_symbol) {
        owner = msg.sender;
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);

        string memory LPTokenSymbol = string(abi.encodePacked(tokenA_symbol, "/", tokenB_symbol, "-LP"));
        string memory LPTokenName = string(abi.encodePacked(tokenA_symbol, "/", tokenB_symbol, " Liquidity Pool Token"));
        lpToken = new LiquidityPoolToken(LPTokenName, LPTokenSymbol);
    }

    // Normalizes a token amount to 18 decimals
    function normalizeAmount(IERC20 token, uint256 amount) internal view returns (uint256) {
        uint8 decimals = ERC20(address(token)).decimals();
        return amount * (10**(18 - decimals));
    }

    // Denormalizes a token amount to its original decimal places
    function denormalizeAmount(IERC20 token, uint256 amount) internal view returns (uint256) {
        uint8 decimals = ERC20(address(token)).decimals();
        return amount / (10**(18 - decimals));
    }

    function deposit(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Amount must be greater than 0");

        // Normalize the amounts based on decimals
        uint256 normalizedAmountA = normalizeAmount(tokenA, amountA);
        uint256 normalizedAmountB = normalizeAmount(tokenB, amountB);

        // Deposit tokens into the contract
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        // Mint LP tokens to the user
        uint256 lpTokenAmount;
        if (tokenA_balance == 0 && tokenB_balance == 0) {
            lpTokenAmount = sqrt(normalizedAmountA * normalizedAmountB);
        } else {
            lpTokenAmount = min(
                (normalizedAmountA * lpToken.totalSupply()) / tokenA_balance,
                (normalizedAmountB * lpToken.totalSupply()) / tokenB_balance
            );
        }

        // Update the normalized balances
        tokenA_balance += normalizedAmountA;
        tokenB_balance += normalizedAmountB;

        lpToken.mint(msg.sender, lpTokenAmount);
    }

    function swap(address inputTokenContract, uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(
            inputTokenContract == address(tokenA) || inputTokenContract == address(tokenB),
            "Invalid token address"
        );

        bool isTokenA = inputTokenContract == address(tokenA);
        IERC20 inputToken = isTokenA ? tokenA : tokenB;
        IERC20 outputToken = isTokenA ? tokenB : tokenA;

        uint256 inputReserve = isTokenA ? tokenA_balance : tokenB_balance;
        uint256 outputReserve = isTokenA ? tokenB_balance : tokenA_balance;

        // Normalizing the input amount
        uint256 normalizedAmount = normalizeAmount(inputToken, amount);
        // console.log("Normalized Amount To Swap: %s", normalizedAmount);
        uint256 amountwithfee = normalizedAmount * (1000 - fee) / 1000;
        // console.log("Amount To Swap with fee: %s", amountwithfee);

        // console.log("Input Reserve: %s", inputReserve); 
        // console.log("Output Reserve: %s", outputReserve);
        // console.log("LP Token Total Supply: %s", lpToken.totalSupply());
        
        // Calculate the output amount based on X * Y = K curve
        uint256 outputAmount = ( outputReserve * amountwithfee ) / (inputReserve + amountwithfee );

        require(outputAmount > 0, "Insufficient output amount");

        // Transfer the input token from the user to the contract (considering the fee)
        inputToken.transferFrom(msg.sender, address(this), amount);

        // console.log("Output Amount: %s", outputAmount);
        // Denormalizing the output amount for the user
        uint256 denormalizedOutputAmount = denormalizeAmount(outputToken, outputAmount);

        // console.log("Denormalized output amount: %s", denormalizedOutputAmount);
        // Transfer the output tokens to the user
        outputToken.transfer(msg.sender, denormalizedOutputAmount);

        // Update the balances
        if (isTokenA) {
            tokenA_balance += normalizedAmount;
            tokenB_balance -= outputAmount;
        } else {
            tokenA_balance -= outputAmount;
            tokenB_balance += normalizedAmount;
        }
    }

    function withdrawLiquidity(uint256 liquidity) external {
        require(liquidity > 0, "Amount must be greater than 0");
        require(lpToken.balanceOf(msg.sender) >= liquidity, "Insufficient LP tokens");

        // Calculate the proportion of the reserves to withdraw
        uint256 amountA = (tokenA_balance * liquidity) / lpToken.totalSupply();
        uint256 amountB = (tokenB_balance * liquidity) / lpToken.totalSupply();

        // Burn the LP tokens from the user
        lpToken.burn(msg.sender, liquidity);

        // Update the normalized balances
        tokenA_balance -= amountA;
        tokenB_balance -= amountB;

        // Denormalize the amounts before transferring
        uint256 denormalizedAmountA = denormalizeAmount(tokenA, amountA);
        uint256 denormalizedAmountB = denormalizeAmount(tokenB, amountB);

        // Transfer the tokens to the user
        tokenA.transfer(msg.sender, denormalizedAmountA);
        tokenB.transfer(msg.sender, denormalizedAmountB);
    }

    // Modifier: used to define a set of rules that must be met before or after a function is executed
    // Check the withdraw() function
    modifier isOwner() {
        // msg.sender: predefined variable that represents address of the account that called the current function
        require(msg.sender == owner, "Not the Owner");
        _;
    }

    /**
     * Function that allows the owner to withdraw all the Ether in the contract
     * The function can only be called by the owner of the contract as defined by the isOwner modifier
     */
    function withdraw() public isOwner {
        (bool success, ) = owner.call{ value: address(this).balance }("");
        require(success, "Failed to send Ether");
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

    /**
     * Function that allows the contract to receive ETH
     */
    receive() external payable {}
}
