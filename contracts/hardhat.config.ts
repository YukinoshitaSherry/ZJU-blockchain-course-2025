import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      // rpc url, change it according to your ganache configuration
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
      // the private key of signers, change it according to your ganache user
      // 私钥应该是64个十六进制字符（0x + 64个字符 = 66个字符）
      // 在Ganache中点击账户右侧的钥匙图标复制私钥
      accounts: [
        '0xfbff38f5f4ef254a58f49e0dcadc0f8241488a03c00d3a8c1cc3895cfab5ca5a' // 请替换为从Ganache复制的完整私钥（64个十六进制字符，可包含或不包含0x前缀）
      ]
    },
  },
};

export default config;
