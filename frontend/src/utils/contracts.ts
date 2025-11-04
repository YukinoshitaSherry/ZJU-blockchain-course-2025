import contractAddresses from './contract-addresses.json';

const Web3 = require('web3');

// 创建web3实例
// 优先使用MetaMask的ethereum provider，如果没有则使用window.web3（旧版兼容），最后fallback到本地Ganache
let web3: any;

if (typeof window !== 'undefined') {
  const windowAny = window as any;
  if (windowAny.ethereum) {
    web3 = new Web3(windowAny.ethereum);
  } else if (windowAny.web3 && windowAny.web3.currentProvider) {
    // 兼容旧版MetaMask
    web3 = new Web3(windowAny.web3.currentProvider);
  } else {
    // 如果没有MetaMask，使用本地Ganache
    web3 = new Web3('http://localhost:8545');
  }
} else {
  web3 = new Web3('http://localhost:8545');
}

// 合约地址
const addresses = contractAddresses as {
  betToken: string;
  lotteryTicket: string;
  bettingPlatform: string;
  orderBook: string;
  network: string;
  chainId: number;
};

// ABI定义（简化版，实际应该从编译后的artifacts中导入）
// 这里先定义基本接口，完整的ABI会在编译后生成
const BetTokenABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_from", "type": "address"},
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "_owner", "type": "address"},
      {"name": "_spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [],
    "name": "airdrop",
    "outputs": [],
    "type": "function"
  }
];

const LotteryTicketABI = [
  {
    "constant": true,
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"name": "", "type": "address"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "getTicketInfo",
    "outputs": [{
      "components": [
        {"name": "projectId", "type": "uint256"},
        {"name": "optionIndex", "type": "uint256"},
        {"name": "purchasePrice", "type": "uint256"},
        {"name": "purchaseTime", "type": "uint256"}
      ],
      "name": "",
      "type": "tuple"
    }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserTickets",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "tokenId", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "tokenId", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [],
    "type": "function"
  }
];

const BettingPlatformABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "title", "type": "string"},
      {"name": "options", "type": "string[]"},
      {"name": "deadline", "type": "uint256"}
    ],
    "name": "createProject",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "projectId", "type": "uint256"},
      {"name": "optionIndex", "type": "uint256"}
    ],
    "name": "buyTicket",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "projectId", "type": "uint256"},
      {"name": "winningOption", "type": "uint256"}
    ],
    "name": "settleProject",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "projectId", "type": "uint256"}],
    "name": "getProject",
    "outputs": [{
      "components": [
        {"name": "projectId", "type": "uint256"},
        {"name": "creator", "type": "address"},
        {"name": "title", "type": "string"},
        {"name": "options", "type": "string[]"},
        {"name": "prizePool", "type": "uint256"},
        {"name": "deadline", "type": "uint256"},
        {"name": "winningOption", "type": "uint256"},
        {"name": "isSettled", "type": "bool"}
      ],
      "name": "",
      "type": "tuple"
    }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "projectId", "type": "uint256"}],
    "name": "getProjectOptions",
    "outputs": [{"name": "", "type": "string[]"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "projectId", "type": "uint256"},
      {"name": "optionIndex", "type": "uint256"}
    ],
    "name": "getOptionTicketCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getAllProjectIds",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "type": "function"
  },
  {
    "type": "event",
    "name": "ProjectCreated",
    "inputs": [
      {"indexed": true, "name": "projectId", "type": "uint256"},
      {"indexed": false, "name": "creator", "type": "address"},
      {"indexed": false, "name": "title", "type": "string"},
      {"indexed": false, "name": "prizePool", "type": "uint256"},
      {"indexed": false, "name": "deadline", "type": "uint256"}
    ]
  },
  {
    "type": "event",
    "name": "TicketPurchased",
    "inputs": [
      {"indexed": true, "name": "projectId", "type": "uint256"},
      {"indexed": true, "name": "tokenId", "type": "uint256"},
      {"indexed": false, "name": "buyer", "type": "address"},
      {"indexed": true, "name": "optionIndex", "type": "uint256"},
      {"indexed": false, "name": "price", "type": "uint256"}
    ]
  }
];

const OrderBookABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "tokenId", "type": "uint256"},
      {"name": "price", "type": "uint256"}
    ],
    "name": "listTicket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "orderId", "type": "uint256"}],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "orderId", "type": "uint256"}],
    "name": "buyFromOrderBook",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "projectId", "type": "uint256"},
      {"name": "optionIndex", "type": "uint256"}
    ],
    "name": "buyAtBestPrice",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "projectId", "type": "uint256"},
      {"name": "optionIndex", "type": "uint256"}
    ],
    "name": "getOrderBook",
    "outputs": [
      {"name": "activeOrderIds", "type": "uint256[]"},
      {"name": "prices", "type": "uint256[]"}
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "orderId", "type": "uint256"}],
    "name": "getOrder",
    "outputs": [{
      "components": [
        {"name": "orderId", "type": "uint256"},
        {"name": "seller", "type": "address"},
        {"name": "tokenId", "type": "uint256"},
        {"name": "projectId", "type": "uint256"},
        {"name": "optionIndex", "type": "uint256"},
        {"name": "price", "type": "uint256"},
        {"name": "isActive", "type": "bool"},
        {"name": "createTime", "type": "uint256"}
      ],
      "name": "",
      "type": "tuple"
    }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserOrders",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "type": "function"
  }
];

// 获取合约实例
const betTokenContract = new web3.eth.Contract(BetTokenABI, addresses.betToken);
const lotteryTicketContract = new web3.eth.Contract(LotteryTicketABI, addresses.lotteryTicket);
const bettingPlatformContract = new web3.eth.Contract(BettingPlatformABI, addresses.bettingPlatform);
const orderBookContract = new web3.eth.Contract(OrderBookABI, addresses.orderBook);

export {
  web3,
  betTokenContract,
  lotteryTicketContract,
  bettingPlatformContract,
  orderBookContract,
  addresses
};

