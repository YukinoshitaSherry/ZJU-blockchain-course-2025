import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { web3, bettingPlatformContract, orderBookContract } from '../utils/contracts';
import './ProjectDetail.css';

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

interface Order {
  orderId: number;
  seller: string;
  tokenId: number;
  price: string;
  isActive: boolean;
}

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [account, setAccount] = useState<string>('');
  const [project, setProject] = useState<Project | null>(null);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [optionCounts, setOptionCounts] = useState<number[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showOrderBook, setShowOrderBook] = useState<boolean>(false);

  useEffect(() => {
    if (projectId) {
      loadProject();
      initCheckAccounts();
    }
  }, [projectId]);

  useEffect(() => {
    if (project && project.options.length > 0) {
      loadOptionCounts();
      loadOrderBook();
    }
  }, [project]);

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

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const proj = await bettingPlatformContract.methods.getProject(projectId).call();
      setProject({
        projectId: parseInt(projectId),
        creator: proj.creator,
        title: proj.title,
        options: proj.options,
        prizePool: proj.prizePool.toString(),
        deadline: parseInt(proj.deadline.toString()),
        winningOption: parseInt(proj.winningOption.toString()),
        isSettled: proj.isSettled,
      });
    } catch (error) {
      console.error('Error loading project:', error);
      alert('加载项目失败');
    }
  };

  const loadOptionCounts = async () => {
    if (!project) return;
    try {
      const counts = await Promise.all(
        project.options.map((_, index) =>
          bettingPlatformContract.methods.getOptionTicketCount(project.projectId, index).call()
        )
      );
      setOptionCounts(counts.map((c: any) => parseInt(c.toString())));
    } catch (error) {
      console.error('Error loading option counts:', error);
    }
  };

  const loadOrderBook = async () => {
    if (!project) return;
    try {
      const allOrders: Order[] = [];
      for (let i = 0; i < project.options.length; i++) {
        const [orderIds, prices] = await orderBookContract.methods
          .getOrderBook(project.projectId, i)
          .call();
        
        for (let j = 0; j < orderIds.length; j++) {
          const order = await orderBookContract.methods.getOrder(orderIds[j]).call();
          allOrders.push({
            orderId: parseInt(order.orderId),
            seller: order.seller,
            tokenId: parseInt(order.tokenId),
            price: order.price,
            isActive: order.isActive,
          });
        }
      }
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading order book:', error);
    }
  };

  const handleBuyTicket = async () => {
    if (!account) {
      alert('请先连接钱包');
      return;
    }

    if (!project) return;

    if (project.isSettled) {
      alert('项目已结算');
      return;
    }

    if (project.deadline * 1000 <= Date.now()) {
      alert('项目已截止');
      return;
    }

    setLoading(true);
    try {
      const ticketPrice = web3.utils.toWei('1', 'ether');
      
      await bettingPlatformContract.methods
        .buyTicket(project.projectId, selectedOption)
        .send({
          from: account,
          value: ticketPrice,
          gas: 3000000
        });

      alert('购买成功！');
      loadOptionCounts();
      loadProject();
    } catch (error: any) {
      alert('购买失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyFromOrder = async (orderId: number, price: string) => {
    if (!account) {
      alert('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      await orderBookContract.methods.buyFromOrderBook(orderId).send({
        from: account,
        value: price,
        gas: 3000000
      });

      alert('购买成功！');
      loadOrderBook();
      loadOptionCounts();
    } catch (error: any) {
      alert('购买失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!account || !project) return;

    if (account.toLowerCase() !== project.creator.toLowerCase()) {
      alert('只有创建者可以结算项目');
      return;
    }

    const winningOptionStr = prompt('请输入获胜选项的索引（从0开始）:');
    if (winningOptionStr === null) return;

    const winningOption = parseInt(winningOptionStr);
    if (isNaN(winningOption) || winningOption < 0 || winningOption >= project.options.length) {
      alert('无效的选项索引');
      return;
    }

    setLoading(true);
    try {
      await bettingPlatformContract.methods
        .settleProject(project.projectId, winningOption)
        .send({
          from: account,
          gas: 3000000
        });

      alert('结算成功！');
      loadProject();
    } catch (error: any) {
      alert('结算失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!project) {
    return <div className="loading">加载中...</div>;
  }

  const isActive = !project.isSettled && project.deadline * 1000 > Date.now();
  const isCreator = account.toLowerCase() === project.creator.toLowerCase();

  return (
    <div className="project-detail-container">
      <div className="project-detail-card">
        <button onClick={() => window.location.href = '/'} className="back-btn">
          ← 返回
        </button>

        <h1>{project.title}</h1>

        <div className="project-info">
          <p><strong>创建者:</strong> {project.creator.slice(0, 6)}...{project.creator.slice(-4)}</p>
          <p><strong>奖池:</strong> {web3.utils.fromWei(project.prizePool, 'ether')} ETH</p>
          <p><strong>截止时间:</strong> {new Date(project.deadline * 1000).toLocaleString('zh-CN')}</p>
          <p><strong>状态:</strong> {
            project.isSettled
              ? `已结算 (获胜: ${project.options[project.winningOption]})`
              : isActive
              ? '进行中'
              : '已截止'
          }</p>
        </div>

        <div className="options-section">
          <h2>选项</h2>
          <div className="options-list">
            {project.options.map((option, index) => {
              const count = optionCounts[index] || 0;
              const totalCount = optionCounts.reduce((sum, c) => sum + c, 0);
              const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0';
              
              return (
                <div key={index} className="option-item">
                  <label>
                    <input
                      type="radio"
                      name="option"
                      value={index}
                      checked={selectedOption === index}
                      onChange={() => setSelectedOption(index)}
                      disabled={!isActive}
                    />
                    <span className="option-name">{option}</span>
                    <span className="count">{count} 张</span>
                    {totalCount > 0 && (
                      <span className="percentage">({percentage}%)</span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>

          {isActive && account && (
            <button
              onClick={handleBuyTicket}
              disabled={loading}
              className="buy-btn"
            >
              {loading ? '购买中...' : '购买彩票 (1 ETH)'}
            </button>
          )}
        </div>

        <div className="actions-section">
          <button
            onClick={() => setShowOrderBook(!showOrderBook)}
            className="toggle-orderbook-btn"
          >
            {showOrderBook ? '隐藏' : '显示'}订单簿
          </button>

          {isCreator && !project.isSettled && project.deadline * 1000 <= Date.now() && (
            <button onClick={handleSettle} className="settle-btn">
              结算项目
            </button>
          )}
        </div>

        {showOrderBook && (
          <div className="orderbook-section">
            <h3>订单簿</h3>
            {orders.length === 0 ? (
              <p className="no-orders">暂无订单</p>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <div key={order.orderId} className="order-item">
                    <div className="order-info">
                      <span>Token #{order.tokenId}</span>
                      <span>价格: {web3.utils.fromWei(order.price, 'ether')} ETH</span>
                      <span>卖家: {order.seller.slice(0, 6)}...{order.seller.slice(-4)}</span>
                    </div>
                    {account && order.seller.toLowerCase() !== account.toLowerCase() && (
                      <button
                        onClick={() => handleBuyFromOrder(order.orderId, order.price)}
                        disabled={loading}
                        className="buy-order-btn"
                      >
                        购买
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;

