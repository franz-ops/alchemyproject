# MultiSwap & Configurable Liquidity Pools

This repository focuses on simplifying operations within the decentralized finance (DeFi) space. It introduces two innovative components: configurable liquidity pools and a multi-swap executor, addressing common issues like complexity, lengthy processes, and high gas costs.

## Problem Statement

DeFi operations often face the following challenges:
- Complexity in performing multiple token swaps.
- Lengthy processes requiring user interaction at every step.
- High gas costs due to multiple transactions.
- Limited configurability in liquidity pools, especially for price curves and other parameters.

## Solution

This project offers:
1. **Configurable Liquidity Pools**: A customizable liquidity pool implementation, allowing developers to define their own pricing curves by implementing the `IPricingCurve` interface. This enables:
   - Dynamic token output calculation.
   - Custom LP token generation mechanisms.
   - Enhanced flexibility to suit different DeFi protocols.

2. **MultiSwap Executor**: A contract enabling users to perform batch token swaps across multiple liquidity pools in a single transaction. It leverages the ERC-2612 standard for off-chain signatures and the `permit` function, allowing gas-efficient approvals without direct on-chain transactions.

## Features

- **Configurable Pricing Curves**: Support for various pricing strategies through an extendable interface.
- **Batch Swapping**: Efficiently swap multiple tokens across pools in one transaction.
- **Off-Chain Signatures**: Reduced gas costs by utilizing the ERC-2612 `permit` functionality.
- **Modular Design**: Easy integration with other DeFi protocols.

## Installation

This project is built on [Scaffold-ETH](https://github.com/scaffold-eth/scaffold-eth), providing a robust framework for Ethereum-based development.

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Yarn](https://yarnpkg.com/)
- [Hardhat](https://hardhat.org/)

### Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/your-repo/multiswap-liquidity-pools.git
   cd multiswap-liquidity-pools
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

5. Run tests:
   ```bash
   yarn test
   ```

## Contracts Overview

### 1. Configurable Liquidity Pools
- Implements a dynamic pricing mechanism using the `IPricingCurve` interface.
- Supports depositing, withdrawing, and swapping tokens with custom logic for LP token issuance.

### 2. MultiSwap Executor
- Facilitates batch token swaps across multiple pools.
- Utilizes off-chain signatures for approvals via the `permit` function, reducing gas costs and simplifying user interaction.

## Usage

1. Start localhost chain:
    ```bash
   yarn chain
   ```

2. Deploy contracts on a local or test network:
   ```bash
   yarn deploy
   ```

2. Interact with the contracts using the provided front-end:
   - Configure liquidity pools.
   - Execute batch swaps.

3. Example batch swap:
   Use the `executeBatchSwapWithPermit` function to perform multiple swaps with minimal user interaction.

## Roadmap

1. **Testnet Deployment**:
   - Deploy contracts to popular Ethereum testnets (e.g. Sepolia).
2. **Enhanced Pricing Curves**:
   - Add new implementations for pricing curves.
   - Integrate price feeds from oracles like Chainlink.
   - Implement user incentive systems.
3. **UI Development**:
   - Create a user-friendly interface for interacting with the MultiSwap Executor and liquidity pools.
4. **Auditing**:
   - Perform security audits to ensure robustness.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any changes or improvements.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Built on [Scaffold-ETH](https://github.com/scaffold-eth/scaffold-eth).
- Inspired by the challenges of simplifying DeFi interactions.
