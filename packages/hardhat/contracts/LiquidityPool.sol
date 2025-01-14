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
    uint256 public constant fee = 700;

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
    
    function deposit(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Amount must be greater than 0");

        uint8 decimalsA = ERC20(address(tokenA)).decimals();
        uint8 decimalsB = ERC20(address(tokenB)).decimals();

        // Normalizza gli importi in base ai decimali
        uint256 normalizedAmountA = amountA * (10**(18 - decimalsA));
        uint256 normalizedAmountB = amountB * (10**(18 - decimalsB));

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

        // Update the balances     
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

        // Calculating the net input amount to be used for the swap
        uint256 amountwithfee = amount * ((1000 - fee) / 1000);

        // Calculate the output amount based on X * Y = K curve
        uint256 outputAmount = outputReserve - (lpToken.totalSupply() / (inputReserve + amountwithfee));

        require(outputAmount > 0, "Insufficient output amount");

        // Transfer the input token from the user to the contract (considering the fee)
        inputToken.transferFrom(msg.sender, address(this), amount);

        // Transfer the output tokens to the user
        outputToken.transfer(msg.sender, outputAmount);

        // Update the balances
        if (isTokenA) {
            tokenA_balance += amount;
            tokenB_balance -= outputAmount;
        } else {
            tokenA_balance -= outputAmount;
            tokenB_balance += amount;
        }
    }

    function withdrawLiquidity(uint256 liquidity) external{
        require(liquidity > 0, "Amount must be greater than 0");
        require(lpToken.balanceOf(msg.sender) >= liquidity, "Insufficient LP tokens");

        // Calculate the amount of tokenA and tokenB to send to the user
        uint256 amountA = (tokenA_balance * liquidity) / lpToken.totalSupply();
        uint256 amountB = (tokenB_balance * liquidity) / lpToken.totalSupply();

        // Burn the LP tokens from the user
        lpToken.burn(msg.sender, liquidity);

        // Update the balances
        tokenA_balance -= amountA;
        tokenB_balance -= amountB;

        // Transfer the tokens to the user
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
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
