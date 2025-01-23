import { expect, use } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const provider = ethers.provider;

async function extractVRS(signature: string) {
    // A signature is 65 bytes long:
    // r: first 32 bytes
    // s: next 32 bytes
    // v: last byte (recovery id)
    console.log(signature);
    const r = signature.slice(0, 66); // First 32 bytes (2 characters per byte, so 64 chars + 0x prefix)
    const s = "0x" + signature.slice(66, 130); // Next 32 bytes
    const v = parseInt(signature.slice(130, 132), 16); // Last byte
  
    return { v, r, s };
  }

async function signPermit(token: any, spender: any, owner: any, _value: any, deadline: number) {
    const owneraddress = await owner.address;

    const domain = {
        name: await token.name(),
        version: "1",
        chainId: await provider.getNetwork().then((n) => n.chainId),
        verifyingContract: await token.getAddress(),
    };
    
    const types = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };

    const value = {
        owner: owneraddress,
        spender: spender,
        value: _value,
        nonce: await token.nonces(owneraddress),
        deadline: deadline,
    };  

    console.log("domain:", domain);
    console.log("types:", types);
    console.log("value:", value);

    console.log(await owner.signTypedData(domain, types, value));
    return await owner.signTypedData(domain, types, value);
}


describe("MultiSwap", function () {
  let wethusdc_liquidityPool: any;
  let wbtcusdc_liquidityPool: any;
  let multiswap_executor: any;  
  let weth: any;
  let wbtc: any;
  let usdc: any;
  let wethaddr: string;
  let usdcaddr: string;
  let wbtcaddr: string;
  let productcurve: any;

  async function deployLiquidityPoolFixture() {
    const [owner, user1] = await ethers.getSigners();
    const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
    const MokenTokenFactory = await ethers.getContractFactory("MockToken");
    const ProductCurveFactory = await ethers.getContractFactory("ConstantProductCurve");
    const MultiSwapFactory = await ethers.getContractFactory("MultiSwapExecutor");

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

    wbtc = await MokenTokenFactory.deploy("Wrapped BTC", "WBTC", ethers.parseUnits("1000000", 18));
    await wbtc.waitForDeployment();
    wbtcaddr = (await wbtc.getAddress()).toLowerCase();

    wethusdc_liquidityPool = await LiquidityPoolFactory.deploy(wethaddr, usdcaddr, "WETH", "USDC", productcurveaddr); //weth/usdc
    await wethusdc_liquidityPool.waitForDeployment();

    wbtcusdc_liquidityPool = await LiquidityPoolFactory.deploy(wbtcaddr, usdcaddr, "WBTC", "USDC", productcurveaddr); //wbtc/usdc
    await wbtcusdc_liquidityPool.waitForDeployment();

    multiswap_executor = await MultiSwapFactory.deploy();
    await multiswap_executor.waitForDeployment();

    const LPAddressWETHUSDC = await wethusdc_liquidityPool.getAddress();
    const LPAddressWBTCUSDC = await wbtcusdc_liquidityPool.getAddress();
    
    await weth.connect(owner).approve(LPAddressWETHUSDC, ethers.parseEther("100000"));
    await usdc.connect(owner).approve(LPAddressWETHUSDC, ethers.parseUnits("300000000", 18));
    await wethusdc_liquidityPool.connect(owner).deposit(ethers.parseEther("100000"), ethers.parseUnits("300000000", 18));

    await wbtc.connect(owner).approve(LPAddressWBTCUSDC, ethers.parseUnits("100000", 18));
    await usdc.connect(owner).approve(LPAddressWBTCUSDC, ethers.parseUnits("10000000000", 18));
    await wbtcusdc_liquidityPool.connect(owner).deposit(ethers.parseUnits("100000", 18), ethers.parseUnits("10000000000", 18));

    // Mint some tokens to user1
    await weth.connect(owner).mint(user1.address, ethers.parseEther("5"));
    await usdc.connect(owner).mint(user1.address, ethers.parseUnits("15000", 18));
    await wbtc.connect(owner).mint(user1.address, ethers.parseUnits("2", 18));

    console.log("User1 Address", user1.address);


    return { multiswap_executor, wethusdc_liquidityPool, wbtcusdc_liquidityPool, wethaddr, usdcaddr, owner, weth, usdc, user1 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { multiswap_executor, wethusdc_liquidityPool, wbtcusdc_liquidityPool} = await loadFixture(deployLiquidityPoolFixture);
      const address = await multiswap_executor.getAddress();
      expect(address).to.be.properAddress;
    });

    it("Should swap successfully using permit", async function () {
        const {
            multiswap_executor, wethusdc_liquidityPool, wbtcusdc_liquidityPool, wethaddr, usdcaddr, owner, weth, usdc, user1
        } = await loadFixture(deployLiquidityPoolFixture);
    
        const LP_WETH_USDC = await wethusdc_liquidityPool.getAddress();
        const LP_WBTC_USDC = await wbtcusdc_liquidityPool.getAddress();

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 h validity

        // Creating off-chain signature to enable MultiswapExecutor to spend weth
        const signature = await signPermit(weth, LP_WETH_USDC, user1, ethers.parseEther("1"), deadline);
        
        // Creating off-chain signature to enable MultiswapExecutor to spend wbtc
        const signature2 = await signPermit(wbtc, LP_WBTC_USDC, user1, ethers.parseUnits("1", 18), deadline);

        const { v: v1, r: r1, s: s1 } = await extractVRS(signature);
        const { v: v2, r: r2, s: s2 } = await extractVRS(signature2);

        const steps = [
            {
                token: wethaddr,
                pool: LP_WETH_USDC,
                amount: ethers.parseEther("1"),
                deadline: deadline,
                v: v1,
                r: r1,
                s: s1,
            },
            {
                token: wbtcaddr,
                pool: LP_WBTC_USDC,
                amount: ethers.parseUnits("1", 18),
                deadline: deadline,
                v: v2,
                r: r2,
                s: s2,
            },
        ]

        console.log("Steps:", steps);
        
        await multiswap_executor.connect(user1).executeBatchSwapWithPermit(steps);
        console.log("Swap ETH/USDC and WBTC/USDC done");
        console.log("usdc balance: ", await usdc.balanceOf(user1.address));
        console.log("weth balance: ", await weth.balanceOf(user1.address));
        console.log("wbtc balance: ", await wbtc.balanceOf(user1.address));

    });
  });    
});
