import React, { useState, useEffect } from 'react';
import { web3, bettingPlatformContract, betTokenContract } from '../utils/contracts';
import './Home.css';

const GanacheTestChainId = '0x539'; // Ganache默认的ChainId = 0x539 = Hex(1337)
const GanacheTestChainName = 'Ganache Test Chain';
const GanacheTestChainRpcUrl = 'http://127.0.0.1:8545';

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
  const [account, setAccount] = useState<string>('');
  const [accountBalance, setAccountBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [connecting, setConnecting] = useState<boolean>(false);

  useEffect(() => {
    initCheckAccounts();
    loadProjects();
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
        console.error('Error getting accounts:', error);
      }
    }
  };

  const connectWallet = async () => {
    const { ethereum } = window as any;
    if (!ethereum || !ethereum.isMetaMask) {
      alert('请安装MetaMask钱包');
      return;
    }

    // 如果已经有账户连接，不需要再次连接
    if (account) {
      return;
    }

    // 如果正在连接中，防止重复点击
    if (connecting) {
      return;
    }

    setConnecting(true);

    try {
      // 如果当前小狐狸不在本地链上，切换Metamask到本地测试链
      if (ethereum.chainId !== GanacheTestChainId) {
        const chain = {
          chainId: GanacheTestChainId, // Chain-ID
          chainName: GanacheTestChainName, // Chain-Name
          rpcUrls: [GanacheTestChainRpcUrl], // RPC-URL
        };

        try {
          // 尝试切换到本地网络
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chain.chainId }]
          });
        } catch (switchError: any) {
          // 如果本地网络没有添加到Metamask中，添加该网络
          if (switchError.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [chain]
            });
          } else {
            throw switchError;
          }
        }
      }

      // 小狐狸成功切换网络了，接下来让小狐狸请求用户的授权
      await ethereum.request({ method: 'eth_requestAccounts' });
      // 获取小狐狸拿到的授权用户列表
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      // 如果用户存在，展示其account，否则显示错误信息
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0] || 'Not able to get accounts');
        // 重新加载余额
        getAccountBalance();
      }
    } catch (error: any) {
      // 忽略"already pending"错误，因为这通常意味着连接正在进行中
      if (!error.message?.includes('already pending')) {
        alert('连接钱包失败: ' + (error.message || '未知错误'));
      }
      console.error('Wallet connection error:', error);
    } finally {
      setConnecting(false);
    }
  };

  const getAccountBalance = async () => {
    if (account) {
      try {
        const balance = await web3.eth.getBalance(account);
        setAccountBalance(web3.utils.fromWei(balance, 'ether'));
        
        // 获取ERC20代币余额
        try {
          const tokenBal = await betTokenContract.methods.balanceOf(account).call();
          setTokenBalance(web3.utils.fromWei(tokenBal, 'ether'));
        } catch (error) {
          console.error('Error getting token balance:', error);
        }
      } catch (error) {
        console.error('Error getting balance:', error);
      }
    }
  };

  const handleClaimAirdrop = async () => {
    if (!account) {
      alert('请先连接钱包');
      return;
    }

    try {
      await betTokenContract.methods.airdrop().send({
        from: account,
        gas: 3000000
      });
      alert('领取成功！');
      getAccountBalance();
    } catch (error: any) {
      if (error.message && error.message.includes('Already claimed')) {
        alert('您已经领取过空投了');
      } else {
        alert('领取失败: ' + (error.message || '未知错误'));
      }
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const projectIds = await bettingPlatformContract.methods.getAllProjectIds().call();
      const projectPromises = projectIds.map(async (id: string) => {
        const project = await bettingPlatformContract.methods.getProject(id).call();
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
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return '未设置';
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const formatEther = (wei: string) => {
    return parseFloat(web3.utils.fromWei(wei, 'ether')).toFixed(4);
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
              <span>账户: {account.slice(0, 6)}...{account.slice(-4)}</span>
              <span>ETH: {parseFloat(accountBalance).toFixed(4)}</span>
              <span>积分: {parseFloat(tokenBalance).toFixed(2)} BET</span>
              <button onClick={handleClaimAirdrop} className="airdrop-btn" title="领取ERC20积分">
                领取积分
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
                className={filter === 'all' ? 'active' : ''} 
                onClick={() => setFilter('all')}
              >
                全部
              </button>
              <button 
                className={filter === 'active' ? 'active' : ''} 
                onClick={() => setFilter('active')}
              >
                进行中
              </button>
              <button 
                className={filter === 'ended' ? 'active' : ''} 
                onClick={() => setFilter('ended')}
              >
                已结束
              </button>
            </div>
            {account && (
              <button onClick={() => window.location.href = '/create'} className="create-btn">
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
              .filter(project => {
                if (filter === 'active') return !project.isSettled && project.deadline * 1000 > Date.now();
                if (filter === 'ended') return project.isSettled || project.deadline * 1000 <= Date.now();
                return true;
              })
              .map((project) => (
              <div
                key={project.projectId}
                className="project-card"
                onClick={() => window.location.href = `/project/${project.projectId}`}
              >
                <h3>{project.title}</h3>
                <div className="project-info">
                  <p><strong>选项:</strong> {project.options.join(', ')}</p>
                  <p><strong>奖池:</strong> {formatEther(project.prizePool)} ETH</p>
                  <p><strong>截止时间:</strong> {formatDate(project.deadline)}</p>
                  <p><strong>状态:</strong> {
                    project.isSettled 
                      ? `已结算 (获胜选项: ${project.options[project.winningOption] || '未知'})`
                      : isProjectActive(project)
                      ? '进行中'
                      : '已截止'
                  }</p>
                </div>
                <button className="view-btn">查看详情</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {account && (
        <nav className="bottom-nav">
          <button onClick={() => window.location.href = '/my-tickets'}>
            我的彩票
          </button>
        </nav>
      )}
    </div>
  );
};

export default Home;

