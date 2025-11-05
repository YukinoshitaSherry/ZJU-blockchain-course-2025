import React, { useState, useEffect } from "react";
import {
  web3,
  bettingPlatformContract,
  betTokenContract,
} from "../utils/contracts";
import "./Home.css";

const GanacheTestChainId = "0x539"; // Ganache默认的ChainId = 0x539 = Hex(1337)
const GanacheTestChainName = "Ganache Test Chain";
const GanacheTestChainRpcUrl = "http://127.0.0.1:8545";

interface Project {
  projectId: number;
  creator: string;
  title: string;
  options: string[];
  prizePool: string;
  deadline: number;
  winningOption: number;
  isSettled: boolean;
}

const Home: React.FC = () => {
  const [account, setAccount] = useState<string>("");
  const [accountBalance, setAccountBalance] = useState<string>("0");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const [connecting, setConnecting] = useState<boolean>(false);

  useEffect(() => {
    initCheckAccounts();
    loadProjects();

    // 监听账户变化（当用户在MetaMask中切换账户时）
    const { ethereum } = window as any;
    if (ethereum && ethereum.isMetaMask) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          // 账户变化后重新获取余额
          setTimeout(() => {
            getAccountBalance();
          }, 100);
        } else {
          setAccount("");
          setAccountBalance("0");
          setTokenBalance("0");
        }
      };

      // 监听账户变化事件
      ethereum.on("accountsChanged", handleAccountsChanged);

      // 监听网络变化事件
      const handleChainChanged = () => {
        // 网络变化时重新加载页面
        window.location.reload();
      };
      ethereum.on("chainChanged", handleChainChanged);

      // 清理函数
      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("accountsChanged", handleAccountsChanged);
          ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (account) {
      getAccountBalance();
    }
  }, [account]);

  const initCheckAccounts = async () => {
    const { ethereum } = window as any;
    if (ethereum && ethereum.isMetaMask) {
      try {
        const accounts = await web3.eth.getAccounts();
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (error) {
        console.error("Error getting accounts:", error);
      }
    }
  };

  // 检查并配置Ganache网络
  const setupGanacheNetwork = async (ethereum: any): Promise<boolean> => {
    const currentChainId = ethereum.chainId;

    if (currentChainId === GanacheTestChainId) {
      return true; // 已经在正确的网络
    }

    const networkConfig = {
      chainId: GanacheTestChainId,
      chainName: GanacheTestChainName,
      rpcUrls: [GanacheTestChainRpcUrl],
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
    };

    try {
      // 尝试切换到Ganache网络
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GanacheTestChainId }],
      });
      return true;
    } catch (switchErr: any) {
      // 网络不存在，需要添加
      if (switchErr.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [networkConfig],
          });
          return true;
        } catch (addErr: any) {
          throw new Error("无法添加Ganache网络: " + addErr.message);
        }
      }
      throw switchErr;
    }
  };

  // 请求账户授权
  const requestAccountAccess = async (
    ethereum: any
  ): Promise<string | null> => {
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      const authorizedAccounts = await ethereum.request({
        method: "eth_accounts",
      });

      if (authorizedAccounts && authorizedAccounts.length > 0) {
        return authorizedAccounts[0];
      }
      return null;
    } catch (err: any) {
      // 如果是pending请求，不抛出错误
      if (err.message?.includes("already pending")) {
        return null;
      }
      throw err;
    }
  };

  const connectWallet = async () => {
    const windowEthereum = (window as any).ethereum;

    // 验证MetaMask是否可用
    if (!windowEthereum || !windowEthereum.isMetaMask) {
      alert("请先安装并启用MetaMask扩展");
      return;
    }

    // 如果正在连接，不重复执行
    if (connecting) {
      return;
    }

    setConnecting(true);

    try {
      // 步骤1: 配置网络
      const networkReady = await setupGanacheNetwork(windowEthereum);
      if (!networkReady) {
        throw new Error("网络配置失败");
      }

      // 步骤2: 请求账户访问权限（允许用户选择账户）
      // 使用 eth_requestAccounts 会弹出账户选择窗口，让用户选择要连接的账户
      // 如果已经连接过，这个调用会允许用户切换账户
      await windowEthereum.request({ method: "eth_requestAccounts" });
      const authorizedAccounts = await windowEthereum.request({
        method: "eth_accounts",
      });

      if (authorizedAccounts && authorizedAccounts.length > 0) {
        const selectedAccount = authorizedAccounts[0];
        setAccount(selectedAccount);
        await getAccountBalance();
        console.log("已连接到账户:", selectedAccount);
      } else {
        console.log("未选择账户");
      }
    } catch (err: any) {
      const errorMsg = err.message || "连接失败";
      if (
        !errorMsg.includes("already pending") &&
        !errorMsg.includes("User rejected")
      ) {
        alert("钱包连接失败: " + errorMsg);
      }
      console.error("钱包连接错误详情:", err);
    } finally {
      setConnecting(false);
    }
  };

  // 断开连接或切换账户
  const disconnectWallet = () => {
    setAccount("");
    setAccountBalance("0");
    setTokenBalance("0");
  };

  // 切换账户（重新连接）
  const switchAccount = async () => {
    const windowEthereum = (window as any).ethereum;

    if (!windowEthereum || !windowEthereum.isMetaMask) {
      alert("请先安装并启用MetaMask扩展");
      return;
    }

    if (connecting) {
      return;
    }

    setConnecting(true);

    try {
      // 配置网络
      const networkReady = await setupGanacheNetwork(windowEthereum);
      if (!networkReady) {
        throw new Error("网络配置失败");
      }

      // 先清除当前账户状态
      const oldAccount = account;
      disconnectWallet();

      // 使用 wallet_requestPermissions 来重新请求权限，这会弹出MetaMask窗口
      // 如果用户有多个账户，MetaMask会显示账户选择界面
      try {
        await windowEthereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (permErr: any) {
        // 如果 wallet_requestPermissions 不支持，使用 eth_requestAccounts
        // 但 eth_requestAccounts 在已授权时可能不会弹出窗口
        console.log(
          "wallet_requestPermissions 不支持，使用 eth_requestAccounts"
        );
      }

      // 重新请求账户访问权限
      // 这会触发MetaMask弹出，让用户选择账户
      await windowEthereum.request({
        method: "eth_requestAccounts",
      });

      // 获取当前MetaMask中选中的账户
      const accounts = await windowEthereum.request({
        method: "eth_accounts",
      });

      if (accounts && accounts.length > 0) {
        const selectedAccount = accounts[0];

        // 检查是否真的切换了账户
        if (selectedAccount === oldAccount) {
          alert(
            '账户未切换！\n\n提示：如果MetaMask没有弹出账户选择窗口，请：\n1. 在MetaMask中手动切换到"Imported Account 1"\n2. 刷新页面（F5）\n3. 前端会自动检测到账户变化'
          );
          setConnecting(false);
          return;
        }

        setAccount(selectedAccount);
        await getAccountBalance();
        console.log("已切换到账户:", selectedAccount);
      } else {
        alert("未检测到账户，请确保MetaMask已连接账户。");
      }
    } catch (err: any) {
      const errorMsg = err.message || "切换账户失败";
      if (!errorMsg.includes("User rejected")) {
        alert(
          "切换账户失败: " +
            errorMsg +
            '\n\n提示：如果MetaMask没有弹出，请直接在MetaMask中切换到"Imported Account 1"，然后刷新页面。'
        );
      }
      console.error("切换账户错误详情:", err);
    } finally {
      setConnecting(false);
    }
  };

  const getAccountBalance = async () => {
    if (account) {
      try {
        const balance = await web3.eth.getBalance(account);
        setAccountBalance(web3.utils.fromWei(balance, "ether"));

        // 获取ERC20代币余额
        try {
          const tokenBal = await betTokenContract.methods
            .balanceOf(account)
            .call();
          setTokenBalance(web3.utils.fromWei(tokenBal, "ether"));
        } catch (error) {
          console.error("Error getting token balance:", error);
        }
      } catch (error) {
        console.error("Error getting balance:", error);
      }
    }
  };

  const handleClaimAirdrop = async () => {
    if (!account) {
      alert("请先连接钱包");
      return;
    }

    // 检查合约是否已初始化
    if (!betTokenContract || !betTokenContract.methods) {
      alert("合约未初始化，请刷新页面重试");
      console.error("betTokenContract未初始化");
      return;
    }

    try {
      // 添加调试信息
      console.log("开始领取积分，账户:", account);
      console.log("betTokenContract地址:", betTokenContract.options.address);

      // 空投是免费的（交易金额为0），但需要Gas费（由Ganache免费提供）
      // 这与demo实现一致：myERC20Contract.methods.airdrop().send({ from: account })
      await betTokenContract.methods.airdrop().send({
        from: account,
        // 注意：不设置value，默认为0 ETH
        // Gas费是必需的，所有区块链交易都需要Gas费（约0.0075 ETH，Ganache免费提供）
      });
      alert("领取成功！");
      getAccountBalance();
    } catch (error: any) {
      // 改进错误处理，确保正确提取错误信息
      let errorMessage = "未知错误";

      if (error) {
        if (typeof error === "string") {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.reason) {
          errorMessage = error.reason;
        } else if (error.data && error.data.message) {
          errorMessage = error.data.message;
        } else {
          // 如果error是对象但没有message，尝试转换为字符串
          try {
            errorMessage = JSON.stringify(error);
          } catch (e) {
            errorMessage = String(error);
          }
        }
      }

      if (
        errorMessage.includes("Already claimed") ||
        errorMessage.includes("已经领取")
      ) {
        alert("您已经领取过空投了");
      } else {
        console.error("领取积分错误详情:", error);
        alert("领取失败: " + errorMessage);
      }
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const projectIds = await bettingPlatformContract.methods
        .getAllProjectIds()
        .call();
      const projectPromises = projectIds.map(async (id: string) => {
        const project = await bettingPlatformContract.methods
          .getProject(id)
          .call();
        return {
          projectId: parseInt(id),
          creator: project.creator,
          title: project.title,
          options: project.options,
          prizePool: project.prizePool,
          deadline: parseInt(project.deadline),
          winningOption: parseInt(project.winningOption),
          isSettled: project.isSettled,
        };
      });
      const loadedProjects = await Promise.all(projectPromises);
      // 按项目ID倒序排列，最新的在前
      loadedProjects.sort((a, b) => b.projectId - a.projectId);
      setProjects(loadedProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "未设置";
    return new Date(timestamp * 1000).toLocaleString("zh-CN");
  };

  const formatEther = (wei: string) => {
    return parseFloat(web3.utils.fromWei(wei, "ether")).toFixed(4);
  };

  const isProjectActive = (project: Project) => {
    return !project.isSettled && project.deadline * 1000 > Date.now();
  };

  return (
    <div className="home-container">
      <header className="header">
        <h1>去中心化彩票平台</h1>
        <div className="wallet-info">
          {account ? (
            <div className="account-info">
              <span>
                账户: {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <span>ETH: {parseFloat(accountBalance).toFixed(4)}</span>
              <span>积分: {parseFloat(tokenBalance).toFixed(2)} BET</span>
              <button
                onClick={handleClaimAirdrop}
                className="airdrop-btn"
                title="领取ERC20积分"
              >
                领取积分
              </button>
              <button
                onClick={switchAccount}
                className="switch-account-btn"
                title="切换账户"
              >
                切换账户
              </button>
            </div>
          ) : (
            <button onClick={connectWallet} className="connect-btn">
              连接钱包
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="projects-header">
          <h2>竞猜项目</h2>
          <div className="header-actions">
            <div className="filter-buttons">
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                全部
              </button>
              <button
                className={filter === "active" ? "active" : ""}
                onClick={() => setFilter("active")}
              >
                进行中
              </button>
              <button
                className={filter === "ended" ? "active" : ""}
                onClick={() => setFilter("ended")}
              >
                已结束
              </button>
            </div>
            {account && (
              <button
                onClick={() => (window.location.href = "/create")}
                className="create-btn"
              >
                创建项目
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">暂无项目</div>
        ) : (
          <div className="projects-grid">
            {projects
              .filter((project) => {
                if (filter === "active")
                  return (
                    !project.isSettled && project.deadline * 1000 > Date.now()
                  );
                if (filter === "ended")
                  return (
                    project.isSettled || project.deadline * 1000 <= Date.now()
                  );
                return true;
              })
              .map((project) => (
                <div
                  key={project.projectId}
                  className="project-card"
                  onClick={() =>
                    (window.location.href = `/project/${project.projectId}`)
                  }
                >
                  <h3>{project.title}</h3>
                  <div className="project-info">
                    <p>
                      <strong>选项:</strong> {project.options.join(", ")}
                    </p>
                    <p>
                      <strong>奖池:</strong> {formatEther(project.prizePool)}{" "}
                      ETH
                    </p>
                    <p>
                      <strong>截止时间:</strong> {formatDate(project.deadline)}
                    </p>
                    <p>
                      <strong>状态:</strong>{" "}
                      {project.isSettled
                        ? `已结算 (获胜选项: ${
                            project.options[project.winningOption] || "未知"
                          })`
                        : isProjectActive(project)
                        ? "进行中"
                        : "已截止"}
                    </p>
                  </div>
                  <button className="view-btn">查看详情</button>
                </div>
              ))}
          </div>
        )}
      </main>

      {account && (
        <nav className="bottom-nav">
          <button onClick={() => (window.location.href = "/my-tickets")}>
            我的彩票
          </button>
        </nav>
      )}
    </div>
  );
};

export default Home;
