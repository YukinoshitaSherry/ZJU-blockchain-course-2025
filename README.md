# 去中心化彩票交易平台

本仓库实现了一个可运行在本地区块链网络上的去中心化彩票交易系统，支持竞猜项目的创建、购买彩票、彩票交易、订单簿展示以及项目结算。项目同时完成了课程的 Bonus ：ERC20 积分系统与链上订单簿。

## 一、项目简介

- **场景**：公证人在平台上创建带有奖池和截止时间的竞猜项目，玩家购买对应选项的彩票并获得 ERC721 凭证；在结果公布前，玩家可通过链上订单簿转让彩票；公证人结算后，胜出玩家平分奖池。
- **目标**：验证智能合约、前端交互、钱包协同工作流程，并为课程作业提供可直接演示的解决方案。

## 二、系统架构

```
ZJU-blockchain-course-2025/
├── contracts/                   # Hardhat 工程与智能合约
│   ├── contracts/
│   │   ├── LotteryTicket.sol    # 彩票 NFT (ERC721)
│   │   ├── BetToken.sol         # 积分 Token (ERC20)
│   │   ├── BettingPlatform.sol  # 主业务合约
│   │   └── OrderBook.sol        # 彩票交易订单簿
│   ├── scripts/deploy.ts        # 一键部署脚本
│   ├── contract-addresses.json  # 最新部署地址（自动生成）
│   └── hardhat.config.ts        # 网络与编译配置
└── frontend/                    # React + TypeScript 前端
    ├── src/pages/
    │   ├── Home.tsx             # 首页与账户信息
    │   ├── CreateProject.tsx    # 创建项目
    │   ├── ProjectDetail.tsx    # 详情、购买彩票、结算、订单簿
    │   └── MyTickets.tsx        # 我的彩票与挂单
    ├── src/utils/contracts.ts   # 合约实例封装
    └── src/utils/contract-addresses.json  # 合约地址（部署脚本同步）
```

## 三、智能合约设计

### 1. LotteryTicket.sol
- 基于 OpenZeppelin `ERC721URIStorage` 与 `Ownable`。
- 记录项目 ID、选项索引、购买价格、购买时间。
- 仅允许主合约 `BettingPlatform` 铸造。
- `getUserTickets(address)` 返回用户持有的所有 Token ID。

### 2. BetToken.sol
- 基于 OpenZeppelin `ERC20`。
- `airdrop()` 限制每个地址仅领取一次 10000 BET。
- Bonus 演示中默认仍使用 ETH 购买彩票，保留 ERC20 支付扩展能力。

### 3. BettingPlatform.sol
- `createProject(string title, string[] options, uint256 deadline)`：创建项目并注入奖池（ETH）。
- `buyTicket(uint256 projectId, uint256 optionIndex)`：玩家支付 1 ETH 获得彩票 NFT。
- `settleProject(uint256 projectId, uint256 winningOption)` / `settleProjectEarly(...)`：公证人结算项目、分发奖池。
- 维护选项购买统计与持有人列表，为结算时计算奖励。

### 4. OrderBook.sol
- `listTicket(uint256 tokenId, uint256 price)`：挂牌出售彩票。挂单前需授权 `setApprovalForAll`。
- `buyFromOrderBook(uint256 orderId)`：按订单 ID 购买。
- `buyAtBestPrice(uint256 projectId, uint256 optionIndex)`：自动选择最低价订单（Bonus 功能）。
- `getOrderBook(projectId, optionIndex)` 与 `tokenToOrder(tokenId)`：提供前端展示与状态检查数据。

### 5. 主要交互流程

| 场景 | 步骤 |
| --- | --- |
| 购买彩票 | 选择选项 → 调用 `buyTicket` 支付 1 ETH → 铸造彩票 NFT → 刷新前端数据 |
| 挂单出售 | `setApprovalForAll(orderBook, true)`（首次自动触发）→ 检查 `tokenToOrder` → 调用 `listTicket` |
| 购买挂单 | 浏览订单簿 → 选择订单/最优价按钮 → 调用 `buyFromOrderBook` 或 `buyAtBestPrice` → NFT 转移 |
| 结算项目 | 公证人输入获胜选项 → 调用 `settleProject` → 按持仓数量平均分奖池 |

## 四、前端实现概览

- **Home.tsx**：处理钱包连接、账户切换、积分领取、项目列表和筛选。
- **CreateProject.tsx**：表单校验、MetaMask 交易提示、创建成功后跳转首页。
- **ProjectDetail.tsx**：展示项目状态、选项统计、订单簿（按选项分组、最优价高亮）、结算入口。
- **MyTickets.tsx**：拉取 NFT 信息，显示项目标题与结算状态，挂单前检查 `tokenToOrder`，自动授权。
- 使用 Web3.js 与部署脚本生成的 ABI/地址交互，Error message 做了明确提示以避免泛化的 JSON-RPC 错误。

## 五、环境与依赖

- Node.js ≥ 16（推荐 18）
- NPM ≥ 8
- Ganache（GUI 或 CLI）
- MetaMask 浏览器扩展

## 六、部署与运行步骤

### 1. 启动本地区块链
1. 打开 Ganache，新建工作区，RPC 保持 `http://127.0.0.1:8545`，Chain ID 默认 1337。
2. 记录一个或多个账户私钥（部署与演示会用到）。

### 2. 配置 Hardhat
1. 进入 `contracts` 目录。
2. 将 `hardhat.config.ts` 中 `accounts` 替换为 Ganache 账户私钥。

### 3. 安装与编译合约
```
cd contracts
npm install
npx hardhat compile
```

### 4. 部署合约
```
npx hardhat run scripts/deploy.ts --network ganache
```
部署完成后，脚本会自动写入：
- `contracts/contract-addresses.json`
- `frontend/src/utils/contract-addresses.json`

### 5. 安装前端依赖并启动
```
cd ../frontend
npm install
npm run start
```
浏览器访问 `http://localhost:3000`。

### 6. 配置 MetaMask
1. 添加自定义网络：RPC URL `http://127.0.0.1:8545`，Chain ID `1337`，符号 `ETH`。
2. 导入 Ganache 账户私钥。
3. 刷新前端页面，点击右上角“连接钱包”。

## 七、功能操作指南（建议演示顺序）

1. **领取积分**：在首页点击“领取积分”，若账户已有余额，会提示已领取。
2. **创建项目**：填写标题、多个选项、奖池金额、截止时间，确认交易。
3. **购买彩票**：进入项目详情，选择选项并购买彩票，确认 1 ETH 交易。
4. **查看彩票**：在“我的彩票”页确认新 NFT，展示项目信息和结算状态。
5. **挂单出售**：输入出售价格，首次会自动执行 `setApprovalForAll`，之后完成 `listTicket`。
6. **展示订单簿**：返回项目详情，点击“显示订单簿”，检查分组及最优价高亮。
7. **按最优价格购买**：切换到另一个账户或让同学帮助挂单，点击“按最优价格购买”验证 Bonus。
8. **取消订单**：在“我的彩票”页点“取消订单”，确认状态刷新。
9. **结算项目**：公证人账户点击“结算项目”或“提前结算（测试）”，输入获胜选项，确认奖金分配。

## 八、Bonus 功能说明

- **ERC20 积分系统**：`airdrop()` 限制一次领取；前端在按钮处做余额预检查，避免重复调用引发 JSON-RPC 错误。
- **链上订单簿**：订单按项目-选项分组，价格升序；最优价高亮并提供一键购买；`tokenToOrder` 预检查防止重复挂单导致的报错。

