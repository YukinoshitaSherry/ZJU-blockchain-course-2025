# 去中心化彩票交易平台

一个支持彩票交易的去中心化彩票系统，允许用户创建竞猜项目、购买彩票、交易彩票，并实现奖金结算。

## 项目概述

本项目实现了一个完整的去中心化彩票交易平台，包含以下核心功能：

- **竞猜项目管理**：公证人可以创建多个竞猜项目，每个项目包含多个选项、奖池和截止时间
- **彩票购买**：玩家可以选择选项并购买彩票，获得ERC721 NFT凭证
- **彩票交易**：玩家可以挂单出售自己的彩票，其他玩家可以购买
- **链上订单簿**：显示所有挂单信息，支持按最优价格购买（Bonus功能）
- **奖金结算**：公证人可以结算项目并自动分发奖金给获胜者
- **ERC20积分系统**：支持使用ERC20代币进行支付（Bonus功能，已实现但默认使用ETH）

## 技术栈

- **智能合约**：Solidity 0.8.20
- **开发框架**：Hardhat 2.18.1
- **前端框架**：React 19.2.0 + TypeScript
- **区块链交互**：Web3.js 1.10.0
- **钱包**：MetaMask
- **测试网络**：Ganache

## 项目结构

```
ZJU-blockchain-course-2025/
├── contracts/              # 智能合约目录
│   ├── contracts/         # 合约源码
│   │   ├── LotteryTicket.sol      # ERC721彩票凭证合约
│   │   ├── BetToken.sol            # ERC20积分代币合约
│   │   ├── BettingPlatform.sol     # 主平台合约
│   │   └── OrderBook.sol           # 订单簿合约
│   ├── scripts/           # 部署脚本
│   │   └── deploy.ts
│   ├── hardhat.config.ts  # Hardhat配置
│   └── package.json
├── frontend/              # 前端目录
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   │   ├── Home.tsx           # 首页（项目列表）
│   │   │   ├── CreateProject.tsx  # 创建项目页面
│   │   │   ├── ProjectDetail.tsx  # 项目详情页面
│   │   │   └── MyTickets.tsx       # 我的彩票页面
│   │   ├── utils/        # 工具函数
│   │   │   ├── contracts.ts       # 合约交互封装
│   │   │   └── contract-addresses.json  # 合约地址
│   │   └── App.tsx       # 主应用组件
│   └── package.json
└── README.md
```

## 如何运行

### 前置要求

1. 安装 Node.js (推荐 v16 或更高版本)
2. 安装 MetaMask 浏览器扩展
3. 下载并安装 Ganache (GUI版本或CLI版本)

### 详细步骤

#### 1. 启动 Ganache

- 打开 Ganache 应用
- 创建一个新的工作空间（Workspace）
- 确保 RPC Server 设置为 `http://127.0.0.1:8545`
- 记录至少一个账户的私钥（用于部署合约）

#### 2. 配置 Hardhat

编辑 `./contracts/hardhat.config.ts`，将 `accounts` 数组中的私钥替换为你的 Ganache 账户私钥：

```typescript
accounts: [
  '你的Ganache账户私钥'  // 替换这里的私钥
]
```

#### 3. 安装合约依赖

在 `./contracts` 目录中运行：

```bash
cd contracts
npm install
```

#### 4. 编译智能合约

在 `./contracts` 目录中运行：

```bash
npx hardhat compile
```

#### 5. 部署智能合约

在 `./contracts` 目录中运行：

```bash
npx hardhat run scripts/deploy.ts --network ganache
```

部署成功后，合约地址会自动保存到：
- `./contracts/contract-addresses.json`
- `./frontend/src/utils/contract-addresses.json`

**重要**：如果部署失败，请检查：
- Ganache 是否正在运行
- `hardhat.config.ts` 中的私钥是否正确
- 账户是否有足够的ETH余额

#### 6. 安装前端依赖

在 `./frontend` 目录中运行：

```bash
cd ../frontend
npm install
```

#### 7. 配置 MetaMask

1. 打开 MetaMask
2. 点击网络选择器，选择"添加网络"
3. 添加 Ganache 网络：
   - 网络名称：`Ganache Test Chain`
   - RPC URL：`http://127.0.0.1:8545`
   - 链ID：`1337`
   - 货币符号：`ETH`
4. 导入 Ganache 账户（使用私钥导入）

#### 8. 启动前端应用

在 `./frontend` 目录中运行：

```bash
npm run start
```

前端应用将在 `http://localhost:3000` 启动。

#### 9. 使用应用

1. 打开浏览器访问 `http://localhost:3000`
2. 点击"连接钱包"按钮，连接 MetaMask
3. 确保 MetaMask 连接到 Ganache 网络（链ID: 1337）

## 功能实现分析

### 1. 智能合约实现

#### 1.1 LotteryTicket.sol (ERC721)
- **功能**：彩票凭证NFT合约
- **实现**：
  - 继承 OpenZeppelin 的 `ERC721URIStorage` 和 `Ownable`
  - 每个Token代表一张彩票，包含项目ID、选项索引、购买价格等信息
  - 只有主合约（BettingPlatform）可以铸造新的彩票
  - 提供 `getUserTickets()` 查询用户拥有的所有彩票

#### 1.2 BetToken.sol (ERC20)
- **功能**：积分代币合约（Bonus功能）
- **实现**：
  - 继承 OpenZeppelin 的 `ERC20`
  - 实现空投功能，用户可领取10000个代币
  - 支持标准的ERC20转账和授权功能

#### 1.3 BettingPlatform.sol (主合约)
- **功能**：管理竞猜项目的核心合约
- **实现**：
  - `createProject()`: 公证人创建项目，需要提供ETH作为奖池
  - `buyTicket()`: 玩家购买彩票，支付1 ETH，获得ERC721 Token
  - `settleProject()`: 公证人结算项目，获胜者平分奖池
  - 记录每个选项的购买数量和持有者列表

#### 1.4 OrderBook.sol (订单簿合约)
- **功能**：管理彩票交易的链上订单簿（Bonus功能）
- **实现**：
  - `listTicket()`: 玩家挂单出售彩票
  - `buyFromOrderBook()`: 按订单ID购买
  - `buyAtBestPrice()`: 按最优价格购买（同一项目同一选项的最低价）
  - `getOrderBook()`: 查询订单簿信息
  - 按项目ID和选项索引组织订单，支持价格排序

### 2. 前端实现

#### 2.1 页面结构
- **首页 (Home.tsx)**：显示所有竞猜项目列表，支持连接钱包
- **创建项目页 (CreateProject.tsx)**：公证人创建新的竞猜项目
- **项目详情页 (ProjectDetail.tsx)**：显示项目信息，支持购买彩票、查看订单簿、结算项目
- **我的彩票页 (MyTickets.tsx)**：显示用户拥有的彩票，支持挂单出售

#### 2.2 核心功能
- **钱包连接**：使用 Web3.js 和 MetaMask 连接
- **合约交互**：封装合约调用，处理交易确认
- **实时更新**：监听合约事件，更新页面状态
- **订单簿显示**：实时显示所有挂单信息，支持按最优价格购买

### 3. 数据流

#### 购买彩票流程
1. 用户在前端选择项目和选项
2. 调用 `BettingPlatform.buyTicket(projectId, optionIndex)`，支付1 ETH
3. 合约铸造ERC721 Token并返回Token ID
4. 更新项目的选项购买数量

#### 交易彩票流程
1. 卖方在前端输入出售价格，调用 `OrderBook.listTicket(tokenId, price)`
2. 合约记录订单信息，授权合约转移NFT
3. 买方查看订单簿，选择订单
4. 调用 `OrderBook.buyFromOrderBook(orderId)`，支付ETH
5. 合约执行NFT转移和ETH转账

#### 结算流程
1. 公证人在前端输入获胜选项索引
2. 调用 `BettingPlatform.settleProject(projectId, winningOption)`
3. 合约计算获胜者，平分奖池
4. 更新项目状态为已结算

## 项目运行截图

（请在此处添加项目运行截图）

### 主要操作流程截图：
1. 连接钱包界面
2. 创建项目界面
3. 购买彩票界面
4. 我的彩票和挂单界面
5. 订单簿显示界面
6. 结算项目界面
7. MetaMask 交易确认截图

## 功能完成情况

### 基础功能 ✅
- ✅ 公证人创建竞猜项目
- ✅ 玩家购买彩票（获得ERC721 Token）
- ✅ 玩家交易彩票（ERC721 Delegate）
- ✅ 公证人结算项目并分发奖金

### Bonus功能 ✅
- ✅ ERC20积分系统（已实现，可通过修改合约使用）
- ✅ 链上订单簿（完全实现，支持按最优价格购买）

## 注意事项

1. **Gas费用**：所有交易都需要支付Gas费用，确保Ganache账户有足够的ETH
2. **网络配置**：确保MetaMask连接到Ganache网络（链ID: 1337）
3. **合约地址**：部署后需要确认合约地址已正确保存到前端配置文件中
4. **时间设置**：创建项目时，截止时间必须是将来的时间（Unix时间戳）

## 参考内容

- 课程的参考Demo见：[DEMOs](https://github.com/LBruyne/blockchain-course-demos)
- 快速实现 ERC721 和 ERC20：[模版](https://wizard.openzeppelin.com/#erc20)
- 如何实现ETH和ERC20的兑换？ [参考讲解](https://www.wtf.academy/en/docs/solidity-103/DEX/)
- Hardhat 官方文档：https://hardhat.org/docs
- Web3.js 官方文档：https://web3js.readthedocs.io/

## 开发说明

本项目基于提供的框架开发，参考了demo项目的结构，但所有代码均为原创实现，未照抄demo代码。

- 智能合约使用 OpenZeppelin 库实现标准ERC721和ERC20
- 前端使用 React + TypeScript 构建
- 使用 Web3.js 进行区块链交互
- 支持 MetaMask 钱包连接

## 许可证

本项目仅用于课程作业，请勿用于商业用途。
