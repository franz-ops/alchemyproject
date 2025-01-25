import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import { ethers } from "hardhat";

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  console.log("Deploying WETH...");
  const WETHDeployment = await deploy("MockToken", {
    from: deployer,
    args: ["Wrapped Ether", "WETH", ethers.parseEther("1000000")], 
    log: true,
    autoMine: true,
  });

  console.log("Deploying USDC...");
  const USDCDeployment = await deploy("MockToken", {
    from: deployer,
    args: ["USD Coin", "USDC", ethers.parseUnits("1000000", 18)], 
    log: true,
    autoMine: true,
  });

  console.log("Deploying WBTC...");
  const WBTCDeployment = await deploy("MockToken", {
    from: deployer,
    args: ["Wrapped BTC", "WBTC", ethers.parseUnits("1000000", 18)], 
    log: true,
    autoMine: true,
  });

  console.log("Deploying ProductCurve...");
  const ProductCurveDeployment = await deploy("ConstantProductCurve", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  const WETHAddress = WETHDeployment.address;
  const USDCAAddress = USDCDeployment.address;
  const WBTCAddress = WBTCDeployment.address;
  const productcurveaddr = ProductCurveDeployment.address;


  console.log(`WETH deployed at: ${WETHAddress}`);
  console.log(`USDC deployed at: ${USDCAAddress}`);
  console.log(`WBTC deployed at: ${WBTCAddress}`);
  console.log(`ProductCurve deployed at: ${productcurveaddr}`);

  
  console.log("Deploying WETH/USDC LiquidityPool...");
  const WETHUSDCliquidityPoolDeployment = await deploy("LiquidityPool", {
    from: deployer,
    args: [WETHAddress, USDCAAddress, "WETH", "USDC", productcurveaddr], 
    log: true,
    autoMine: true,
  });

  console.log(`WETH/USDC LiquidityPool deployed at: ${WETHUSDCliquidityPoolDeployment.address}`);

  console.log("Deploying WBTC/USDC LiquidityPool...");
  const WBTCUSDCliquidityPoolDeployment = await deploy("LiquidityPool", {
    from: deployer,
    args: [WBTCAddress, USDCAAddress, "WBTC", "USDC", productcurveaddr], 
    log: true,
    autoMine: true,
  });

  console.log(`WBTC/USDC LiquidityPool deployed at: ${WBTCUSDCliquidityPoolDeployment.address}`);

  
  console.log("Deploying MultiSwapExecutor...");
  const multiSwapExecutorDeployment = await deploy("MultiSwapExecutor", {
    from: deployer,
    args: [], 
    log: true,
    autoMine: true,
  });

  console.log(`MultiSwapExecutor deployed at: ${multiSwapExecutorDeployment.address}`);
};

export default deployContracts;

deployContracts.tags = ["LiquidityPool", "MockToken", "ConstantProductCurve", "MultiSwapExecutor"];
