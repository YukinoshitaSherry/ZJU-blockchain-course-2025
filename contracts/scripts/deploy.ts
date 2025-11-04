import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 部署合约
  console.log("\n1. Deploying BetToken (ERC20)...");
  const BetToken = await ethers.getContractFactory("BetToken");
  const betToken = await BetToken.deploy();
  await betToken.deployed();
  const betTokenAddress = betToken.address;
  console.log("BetToken deployed to:", betTokenAddress);

  console.log("\n2. Deploying LotteryTicket (ERC721)...");
  const LotteryTicket = await ethers.getContractFactory("LotteryTicket");
  const lotteryTicket = await LotteryTicket.deploy();
  await lotteryTicket.deployed();
  const lotteryTicketAddress = lotteryTicket.address;
  console.log("LotteryTicket deployed to:", lotteryTicketAddress);

  console.log("\n3. Deploying BettingPlatform...");
  // 使用ETH支付（useERC20Payment = false）
  const BettingPlatform = await ethers.getContractFactory("BettingPlatform");
  const bettingPlatform = await BettingPlatform.deploy(
    lotteryTicketAddress,
    betTokenAddress,
    false // 使用ETH支付
  );
  await bettingPlatform.deployed();
  const bettingPlatformAddress = bettingPlatform.address;
  console.log("BettingPlatform deployed to:", bettingPlatformAddress);

  // 设置BettingPlatform为LotteryTicket的授权合约
  console.log("\n4. Setting BettingPlatform as authorized minter...");
  const setPlatformTx = await lotteryTicket.setBettingPlatform(bettingPlatformAddress);
  await setPlatformTx.wait();
  console.log("Authorization set successfully");

  console.log("\n5. Deploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(
    lotteryTicketAddress,
    betTokenAddress,
    bettingPlatformAddress,
    false // 使用ETH支付
  );
  await orderBook.deployed();
  const orderBookAddress = orderBook.address;
  console.log("OrderBook deployed to:", orderBookAddress);

  // 保存合约地址到JSON文件
  const addresses = {
    betToken: betTokenAddress,
    lotteryTicket: lotteryTicketAddress,
    bettingPlatform: bettingPlatformAddress,
    orderBook: orderBookAddress,
    network: "ganache",
    chainId: 1337
  };

  // 保存到contracts目录
  const contractsDir = path.join(__dirname, "..");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(contractsDir, "contract-addresses.json"),
    JSON.stringify(addresses, null, 2)
  );

  // 同时保存到frontend目录
  const frontendDir = path.join(__dirname, "..", "..", "frontend", "src", "utils");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendDir, "contract-addresses.json"),
    JSON.stringify(addresses, null, 2)
  );

  // 复制ABI文件到frontend
  const abiDir = path.join(frontendDir, "abis");
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
  const contractNames = ["BetToken", "LotteryTicket", "BettingPlatform", "OrderBook"];
  
  for (const contractName of contractNames) {
    const artifactPath = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      fs.writeFileSync(
        path.join(abiDir, `${contractName}.json`),
        JSON.stringify(artifact.abi, null, 2)
      );
      console.log(`ABI copied: ${contractName}.json`);
    }
  }

  console.log("\n✅ All contracts deployed successfully!");
  console.log("\nContract addresses saved to:");
  console.log("  - contracts/contract-addresses.json");
  console.log("  - frontend/src/utils/contract-addresses.json");
  console.log("\nDeployed addresses:");
  console.log(addresses);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
