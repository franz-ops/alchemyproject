import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("LiquidityPool", function () {
  let liquidityPool: any;
  let weth: any;
  let usdc: any;
  let wethaddr: string;
  let usdcaddr: string;
  let productcurve: any;

  async function deployLiquidityPoolFixture() {
    const [owner, user1] = await ethers.getSigners();
    const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
    const MokenTokenFactory = await ethers.getContractFactory("MockToken");
    const ProductCurveFactory = await ethers.getContractFactory("ConstantProductCurve");

    productcurve = await ProductCurveFactory.deploy();
    productcurve = await productcurve.waitForDeployment();
    const productcurveaddr = (await productcurve.getAddress()).toLowerCase();

    // create weth and usdc tokens
    weth = await MokenTokenFactory.deploy("Wrapped Ether", "WETH", ethers.parseEther("1000000"));
    await weth.waitForDeployment();
    wethaddr = (await weth.getAddress()).toLowerCase();

    usdc = await MokenTokenFactory.deploy("USD Coin", "USDC", ethers.parseUnits("1000000", 18));
    await usdc.waitForDeployment();
    usdcaddr = (await usdc.getAddress()).toLowerCase();

    const weth_symbol = "WETH";
    const usdc_symbol = "USDC";
    liquidityPool = await LiquidityPoolFactory.deploy(wethaddr, usdcaddr, weth_symbol, usdc_symbol, productcurveaddr); //weth/usdc
    await liquidityPool.waitForDeployment();

    // Mint some tokens to user1
    await weth.connect(owner).mint(user1.address, ethers.parseEther("5"));
    await usdc.connect(owner).mint(user1.address, ethers.parseUnits("15000", 18));

    return { liquidityPool, wethaddr, usdcaddr, owner, weth, usdc, user1 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { liquidityPool } = await loadFixture(deployLiquidityPoolFixture);
      const address = await liquidityPool.getAddress();
      expect(address).to.be.properAddress;
    });

    it("Should set correct tokens", async function () {
      const { liquidityPool, wethaddr, usdcaddr } = await loadFixture(deployLiquidityPoolFixture);
      const tokenA = (await liquidityPool.tokenA()).toLowerCase();
      const tokenB = (await liquidityPool.tokenB()).toLowerCase();
      expect(tokenA).to.be.equal(wethaddr);
      expect(tokenB).to.be.equal(usdcaddr);
    });

    it("Should set correct LP Token name", async function () {
      const { liquidityPool } = await loadFixture(deployLiquidityPoolFixture);
      const tokenLPaddr = await liquidityPool.lpToken();
      const tokenLP = await ethers.getContractAt("LiquidityPoolToken", tokenLPaddr);
      const tokenName = await tokenLP.name();
      const tokenSymbol = await tokenLP.symbol();

      expect(tokenName).to.be.equal("WETH/USDC Liquidity Pool Token");
      expect(tokenSymbol).to.be.equal("WETH/USDC-LP");
    });
  });

  describe("Add/Remove Liquidity", function () {
    it("Should add first liquidity successfully and give sqrt(tokenA*tokenB) LP token", async function () {
      const { liquidityPool, owner, weth, usdc } = await loadFixture(deployLiquidityPoolFixture);
      const amountWETH = ethers.parseEther("1");
      const amountUSDC = ethers.parseUnits("3000", 18);
      const LPAddress = await liquidityPool.getAddress();

      await weth.connect(owner).approve(LPAddress, amountWETH);
      await usdc.connect(owner).approve(LPAddress, amountUSDC);

      await liquidityPool.connect(owner).deposit(amountWETH, amountUSDC);
      expect(await liquidityPool.tokenA_balance()).to.be.equal(amountWETH);
      expect(await liquidityPool.tokenB_balance()).to.be.equal(amountUSDC);

      const lpTokenAddr = await liquidityPool.lpToken();
      const lpToken = await ethers.getContractAt("LiquidityPoolToken", lpTokenAddr);
      const lpTokenBalance = await lpToken.balanceOf(owner.address);
      const totalSupply = await lpToken.totalSupply();
      console.log("Owner LP Token Balance: ", lpTokenBalance);

      // expect 54.77 LP tokens to be minted
      expect(lpTokenBalance).to.be.lessThan(ethers.parseUnits("5478", 16));
      expect(lpTokenBalance).to.be.greaterThan(ethers.parseUnits("5477", 16));

      // expect 54.77 LP tokens to be minted
      expect(totalSupply).to.be.lessThan(ethers.parseUnits("5478", 16));
      expect(totalSupply).to.be.greaterThan(ethers.parseUnits("5477", 16));

      // expect token A and B balances to be updated
      expect(await liquidityPool.tokenA_balance()).to.be.equal(amountWETH);
      expect(await liquidityPool.tokenB_balance()).to.be.equal(amountUSDC);
    });

    it("Should add liquidity for existing pool and give token*LPSupply LP tokens", async function () {
      const { liquidityPool, owner, weth, usdc, user1 } = await loadFixture(deployLiquidityPoolFixture);

      // First deposit
      const amountWETH = ethers.parseEther("1");
      const amountUSDC = ethers.parseUnits("3000", 18);
      const LPAddress = await liquidityPool.getAddress();

      await weth.connect(owner).approve(LPAddress, amountWETH);
      await usdc.connect(owner).approve(LPAddress, amountUSDC);

      await liquidityPool.connect(owner).deposit(amountWETH, amountUSDC);

      // Second deposit of user1
      const amountWETH2 = ethers.parseEther("2");
      const amountUSDC2 = ethers.parseUnits("8000", 18);

      await weth.connect(user1).approve(LPAddress, amountWETH2);
      await usdc.connect(user1).approve(LPAddress, amountUSDC2);

      await liquidityPool.connect(user1).deposit(amountWETH2, amountUSDC2);
      expect(await liquidityPool.tokenA_balance()).to.be.equal(amountWETH + amountWETH2);
      expect(await liquidityPool.tokenB_balance()).to.be.equal(amountUSDC + amountUSDC2);

      const lpTokenAddr = await liquidityPool.lpToken();
      const lpToken = await ethers.getContractAt("LiquidityPoolToken", lpTokenAddr);
      const lpTokenBalance = await lpToken.balanceOf(user1.address);
      const totalSupply = await lpToken.totalSupply();

      /* expect 109,54 LP tokens to be minted, cause min(109.54, 146.05) = 109.54
        lpTokenAmount = min(
            (normalizedAmountA * lpToken.totalSupply()) / tokenA_balance,
            (normalizedAmountB * lpToken.totalSupply()) / tokenB_balance
        );
      */
      expect(lpTokenBalance).to.be.lessThan(ethers.parseUnits("10955", 16));
      expect(lpTokenBalance).to.be.greaterThan(ethers.parseUnits("10954", 16));

      // expect 54.77 LP tokens to be minted
      expect(totalSupply).to.be.lessThan(ethers.parseUnits("16433", 16));
      expect(totalSupply).to.be.greaterThan(ethers.parseUnits("16431", 16));
      console.log("Total LP Token Supply: ", totalSupply);
    });

    it("Should remove liquidity successfully and give back exact token amounts", async function () {
      const { liquidityPool, owner, weth, usdc, user1 } = await loadFixture(deployLiquidityPoolFixture);
      const WETHBalance = await weth.balanceOf(owner.address);
      const USDCBalance = await usdc.balanceOf(owner.address);
      // console.log("Before deposit weth balance: ", WETHBalance.toString());
      // console.log("Before deposit usdc balance: ", USDCBalance.toString());
      // First deposit
      const amountWETH = ethers.parseEther("1");
      const amountUSDC = ethers.parseUnits("3000", 18);
      const LPAddress = await liquidityPool.getAddress();

      await weth.connect(owner).approve(LPAddress, amountWETH);
      await usdc.connect(owner).approve(LPAddress, amountUSDC);

      await liquidityPool.connect(owner).deposit(amountWETH, amountUSDC);

      //console.log("After deposit weth balance: ", (await weth.balanceOf(owner.address)));
      //console.log("After deposit usdc balance: ", (await usdc.balanceOf(owner.address)));

      // Withdraw all liquidity
      const lptokencontract = await ethers.getContractAt("LiquidityPoolToken", await liquidityPool.lpToken());
      let lpTokenBalance = await lptokencontract.balanceOf(owner.address);
      //console.log("Balance of LP Token: ", lpTokenBalance.toString());

      await liquidityPool.connect(owner).withdrawLiquidity(lpTokenBalance);
      lpTokenBalance = await lptokencontract.balanceOf(owner.address);
      const WETHBalanceAfter = await weth.balanceOf(owner.address);
      const USDCBalanceAfter = await usdc.balanceOf(owner.address);
      
      /*console.log("Owner's balance of LP Token: ", lpTokenBalance.toString());
      console.log("After withdraw weth balance: ", WETHBalanceAfter.toString());
      console.log("After withdraw usdc balance: ", USDCBalanceAfter.toString());
      console.log("lpToken Supply: ", await lptokencontract.totalSupply());*/
      
      // WETH and USDC balances should be the same as before deposit
      expect(WETHBalanceAfter).to.be.equal(WETHBalance);
      expect(USDCBalanceAfter).to.be.equal(USDCBalance);
      // LP token supply should be 0
      expect(await lptokencontract.totalSupply()).to.be.equal(0);
      // LP token owner balance should be 0
      expect(lpTokenBalance).to.be.equal(0);

    });
  });

  describe("Swap", function () {
    it("Should Swap tokens successfully", async function () {
      const { liquidityPool, owner, weth, usdc, user1 } = await loadFixture(deployLiquidityPoolFixture);
      const LPAddress = await liquidityPool.getAddress();
      const WETHAddress = await weth.getAddress();

      // Owner deposits 10 WETH and 30000 USDC into the pool
      const amountWETH = ethers.parseEther("10000");
      const amountUSDC = ethers.parseUnits("30000000", 18);

      await weth.connect(owner).approve(LPAddress, amountWETH);
      await usdc.connect(owner).approve(LPAddress, amountUSDC);

      await liquidityPool.connect(owner).deposit(amountWETH, amountUSDC);

      // User1 swaps 1 WETH to USDC
      let initialWETHBalance = await weth.balanceOf(user1.address);
      let initialUSDCBalance = await usdc.balanceOf(user1.address);
      await weth.connect(user1).approve(LPAddress, ethers.parseEther("1"));
      await liquidityPool.connect(user1).swap(WETHAddress, ethers.parseEther("1"));
      
      // Check balances
      let finalWETHBalance = await weth.balanceOf(user1.address);
      let finalUSDCBalance = await usdc.balanceOf(user1.address);
      console.log("Initial WETH balance: ", initialWETHBalance);
      console.log("Final WETH balance: ", finalWETHBalance);

      expect(finalWETHBalance).to.be.equal(initialWETHBalance - ethers.parseEther("1"));
      
      expect(finalUSDCBalance).to.be.greaterThan(initialUSDCBalance);

      console.log("Initial USDC balance: ", initialUSDCBalance);
      console.log("Final USDC balance: ", finalUSDCBalance);
    });

    it("Should take 0.3% fee on swap", async function () {
      const { liquidityPool, owner, weth, usdc, user1 } = await loadFixture(deployLiquidityPoolFixture);
      const LPAddress = await liquidityPool.getAddress();
      const WETHAddress = await weth.getAddress();
      let initialUSDCBalance = await usdc.balanceOf(user1.address);
      
      // Owner deposits 10 WETH and 30000 USDC into the pool
      // Assuming 1 ETH = 3000 USDC
      const amountDepositWETH = ethers.parseEther("10000");
      const amountDepositUSDC = ethers.parseUnits("30000000", 18);

      await weth.connect(owner).approve(LPAddress, amountDepositWETH);
      await usdc.connect(owner).approve(LPAddress, amountDepositUSDC);
      await liquidityPool.connect(owner).deposit(amountDepositWETH, amountDepositUSDC);
      
      let InitialTokenBBalance = await liquidityPool.tokenB_balance(); // USDC balance in the pool

      // The pool has 10 WETH and 30000 USDC, user1 swaps 1 WETH to USDC
      await weth.connect(user1).approve(LPAddress, ethers.parseEther("1"));
      await liquidityPool.connect(user1).swap(WETHAddress, ethers.parseEther("1"));
      let finalUSDCBalance = await usdc.balanceOf(user1.address);
      console.log("Initial USDC balance: ", initialUSDCBalance);
      console.log("Final USDC balance: ", finalUSDCBalance);

      // With a Pool with large reserves, the swap should be close to the market price
      // The swap fee is 0.3% of the swap amount, so 
      // 1 WETH = 3000 USDC, 0.3% of 3000 = 9 USDC. So the fee should be approximately 9 USDC. (considering slippage)
      let swappedAmount = finalUSDCBalance - initialUSDCBalance;
      expect(swappedAmount).to.be.greaterThan(ethers.parseEther("2980"));
      expect(swappedAmount).to.be.lessThan(ethers.parseEther("3000"));
      console.log("Token A balance: ", await liquidityPool.tokenA_balance());
      console.log("Token B balance: ", await liquidityPool.tokenB_balance());
      
      // USDC balance in the pool should be reduced by swapped amount + 9 USDC
      expect(await liquidityPool.tokenB_balance()).to.be.approximately( InitialTokenBBalance - swappedAmount, ethers.parseEther("1") );
    });
  });
});
