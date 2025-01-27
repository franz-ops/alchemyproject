import { ethers } from "hardhat";

async function main() {
  const [deployer, user] = await ethers.getSigners();

  // Addresses of deployed contracts (replace these values with your own)
  const WETH_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const USDC_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const WBTC_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const LIQUIDITY_POOL_WETH_USDC = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const LIQUIDITY_POOL_WBTC_USDC = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const MULTI_SWAP_EXECUTOR = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

  // Retrieve contract objects
  const WETH = await ethers.getContractAt("MockToken", WETH_ADDRESS);
  const USDC = await ethers.getContractAt("MockToken", USDC_ADDRESS);
  const WBTC = await ethers.getContractAt("MockToken", WBTC_ADDRESS);
  const LiquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_WETH_USDC);
  const LiquidityPool2 = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_WBTC_USDC);
  const MultiSwapExecutor = await ethers.getContractAt("MultiSwapExecutor", MULTI_SWAP_EXECUTOR);

  console.log("Initialization complete. Interacting with contracts...");

  // 1. Mint tokens for the user
  console.log("Minting tokens for the user...");
  await WETH.connect(deployer).mint(user.address, ethers.parseEther("10"));
  await USDC.connect(deployer).mint(user.address, ethers.parseUnits("10000", 18));
  await WBTC.connect(deployer).mint(user.address, ethers.parseUnits("5", 18));

  console.log("Minting complete!");
  console.log("WETH Balance:", await WETH.balanceOf(user.address));
  console.log("USDC Balance:", await USDC.balanceOf(user.address));
  console.log("WBTC Balance:", await WBTC.balanceOf(user.address));

  // 2. Approve the pool to use the tokens
  console.log("Approving the pool to use tokens...");
  await WETH.connect(deployer).approve(LIQUIDITY_POOL_WETH_USDC, ethers.parseEther("100000"));
  await USDC.connect(deployer).approve(LIQUIDITY_POOL_WETH_USDC, ethers.parseUnits("300000000", 18));
  await WBTC.connect(deployer).approve(LIQUIDITY_POOL_WBTC_USDC, ethers.parseUnits("100000", 18));
  await USDC.connect(deployer).approve(LIQUIDITY_POOL_WBTC_USDC, ethers.parseUnits("10000000000", 18));

  console.log("Approval complete!");

  // 3. Deposit into the liquidity pool
  console.log("Depositing into the WETH/USDC and WBTC/USDC liquidity pool...");
  await LiquidityPool.connect(deployer).deposit(ethers.parseEther("100000"), ethers.parseUnits("300000000", 18));
  await LiquidityPool2.connect(deployer).deposit(ethers.parseUnits("100000", 18), ethers.parseUnits("10000000000", 18));
  console.log("Deposit complete!");



  // 4. Create the swap with MultiSwapExecutor
  const deadline = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour

  // Create a permit signing function and generate the signature
  async function signPermit(token: any, spender: any, owner: any, _value: any, deadline: number) {
    const owneraddress = await owner.address;

    const domain = {
        name: await token.name(),
        version: "1",
        chainId: await ethers.provider.getNetwork().then((n) => n.chainId),
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

    return await owner.signTypedData(domain, types, value);
}

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

  console.log("Creating signature for permit...");
  const permitSignature = await signPermit(WETH, LIQUIDITY_POOL_WETH_USDC, user, ethers.parseEther("1"), deadline);
  const permitSignature2 = await signPermit(WBTC, LIQUIDITY_POOL_WBTC_USDC, user, ethers.parseUnits("1", 18), deadline);
  const { v, r, s } = await extractVRS(permitSignature);
  const { v: v2, r: r2, s: s2 } = await extractVRS(permitSignature2);

  // 5. Execute the swap
  console.log("Executing the swap WETH -> USDC...");
  await MultiSwapExecutor.connect(user).executeBatchSwapWithPermit([
    {
      token: WETH_ADDRESS,
      pool: LIQUIDITY_POOL_WETH_USDC,
      amount: ethers.parseEther("1"),
      deadline,
      v,
      r,
      s,
    },
    {
      token: WBTC_ADDRESS,
      pool: LIQUIDITY_POOL_WBTC_USDC,
      amount: ethers.parseUnits("1", 18),
      deadline,
      v: v2,
      r: r2,
      s: s2,
    },
  ]);

  console.log("Swap complete!");
  console.log("New USDC balance:", await USDC.balanceOf(user.address));
  console.log("New WETH balance:", await WETH.balanceOf(user.address));
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
