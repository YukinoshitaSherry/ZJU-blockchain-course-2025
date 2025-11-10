import React, { useState, useEffect } from 'react';
import { web3, lotteryTicketContract, orderBookContract, bettingPlatformContract, addresses } from '../utils/contracts';
import './MyTickets.css';

interface Ticket {
  tokenId: number;
  projectId: number;
  optionIndex: number;
  purchasePrice: string;
  purchaseTime: number;
  projectTitle?: string;
  optionName?: string;
  projectSettled: boolean;
  winningOption: number;
}

interface Order {
  orderId: number;
  tokenId: number;
  price: string;
  isActive: boolean;
}

const MyTickets: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [sellPrice, setSellPrice] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasApprovalForAll, setHasApprovalForAll] = useState<boolean>(false);

  useEffect(() => {
    initCheckAccounts();
  }, []);

  useEffect(() => {
    if (account) {
      refreshApprovalStatus();
      loadTickets();
      loadMyOrders();
    }
  }, [account]);

  // 添加监听事件，当购买彩票后刷新
  useEffect(() => {
    const { ethereum } = window as any;
    if (ethereum && ethereum.isMetaMask) {
      // 监听区块链事件，当有新的交易时刷新
      const handleChainChanged = () => {
        if (account) {
          loadTickets();
        }
      };
      
      ethereum.on('chainChanged', handleChainChanged);
      
      // 定期刷新（每5秒检查一次）
      const refreshInterval = setInterval(() => {
        if (account) {
          loadTickets();
        }
      }, 5000);
      
      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener('chainChanged', handleChainChanged);
        }
        clearInterval(refreshInterval);
      };
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

  const loadTickets = async () => {
    if (!account) return;
    try {
      console.log('加载彩票，账户:', account);
      console.log('lotteryTicketContract地址:', lotteryTicketContract.options.address);
      
      const tokenIds = await lotteryTicketContract.methods.getUserTickets(account).call();
      console.log('获取到的Token IDs:', tokenIds);
      
      if (!tokenIds || tokenIds.length === 0) {
        console.log('用户没有彩票，tokenIds为空数组');
        setTickets([]);
        return;
      }
      
      // 预先缓存项目及选项信息，避免重复调用
      const projectCache: Record<string, any> = {};
      const optionCache: Record<string, string[]> = {};

      const ticketPromises = tokenIds.map(async (tokenId: string) => {
        try {
          const info = await lotteryTicketContract.methods.getTicketInfo(tokenId).call();
          const projectKey = info.projectId.toString();

          if (!projectCache[projectKey]) {
            projectCache[projectKey] = await bettingPlatformContract.methods
              .getProject(info.projectId)
              .call();
          }

          if (!optionCache[projectKey]) {
            optionCache[projectKey] = await bettingPlatformContract.methods
              .getProjectOptions(info.projectId)
              .call();
          }

          const projectInfo = projectCache[projectKey];
          const optionNames = optionCache[projectKey];
          console.log(`Token ${tokenId} 信息:`, info);
          return {
            tokenId: parseInt(tokenId),
            projectId: parseInt(info.projectId),
            optionIndex: parseInt(info.optionIndex),
            purchasePrice: info.purchasePrice,
            purchaseTime: parseInt(info.purchaseTime),
            projectTitle: projectInfo.title,
            optionName: optionNames[parseInt(info.optionIndex)] ?? '',
            projectSettled: projectInfo.isSettled,
            winningOption: parseInt(projectInfo.winningOption?.toString?.() ?? projectInfo.winningOption),
          };
        } catch (err) {
          console.error(`获取Token ${tokenId}信息失败:`, err);
          return null;
        }
      });
      
      const loadedTickets = await Promise.all(ticketPromises);
      const validTickets = loadedTickets.filter(ticket => ticket !== null) as Ticket[];
      console.log('加载的彩票列表:', validTickets);
      setTickets(validTickets);
    } catch (error: any) {
      console.error('Error loading tickets:', error);
      console.error('错误详情:', error.message || error);
      // 显示错误信息给用户
      if (error.message) {
        console.error('错误消息:', error.message);
      }
      setTickets([]);
    }
  };

  const loadMyOrders = async () => {
    if (!account) return;
    try {
      const orderIds = await orderBookContract.methods.getUserOrders(account).call();
      const orderPromises = orderIds.map(async (orderId: string) => {
        const order = await orderBookContract.methods.getOrder(orderId).call();
        return {
          orderId: parseInt(order.orderId),
          tokenId: parseInt(order.tokenId),
          price: order.price,
          isActive: order.isActive,
        };
      });
      const loadedOrders = await Promise.all(orderPromises);
      setOrders(loadedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handleListTicket = async () => {
    if (!selectedTicket) {
      alert('请选择要出售的彩票');
      return;
    }

    const ticket = tickets.find((t) => t.tokenId === selectedTicket);
    if (ticket?.projectSettled) {
      alert('该项目已结算，不能再出售。');
      return;
    }

    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      alert('请输入有效的出售价格');
      return;
    }

    setLoading(true);
    try {
      const priceInWei = web3.utils.toWei(sellPrice, 'ether');

      const existedOrderId = await orderBookContract.methods
        .tokenToOrder(selectedTicket)
        .call();
      if (web3.utils.toBN(existedOrderId).gt(web3.utils.toBN(0))) {
        alert('该彩票已经挂单，请先取消原有订单');
        await loadMyOrders();
        setLoading(false);
        return;
      }

      if (!hasApprovalForAll) {
        await lotteryTicketContract.methods
          .setApprovalForAll(addresses.orderBook, true)
          .send({
            from: account,
            gas: 3000000,
          });
        setHasApprovalForAll(true);
        console.log('已为所有彩票开启订单簿合约授权');
      }

      // 挂单
      await orderBookContract.methods
        .listTicket(selectedTicket, priceInWei)
        .send({
          from: account,
          gas: 3000000
        });

      alert('挂单成功！');
      setSelectedTicket(null);
      setSellPrice('1');
      loadMyOrders();
    } catch (error: any) {
      alert('挂单失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('确定要取消这个订单吗？')) return;

    setLoading(true);
    try {
      await orderBookContract.methods.cancelOrder(orderId).send({
        from: account,
        gas: 3000000
      });

      alert('取消成功！');
      loadMyOrders();
    } catch (error: any) {
      alert('取消失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderForTicket = (tokenId: number) => {
    return orders.find(order => order.tokenId === tokenId && order.isActive);
  };

  const refreshApprovalStatus = async () => {
    try {
      const approved = await lotteryTicketContract.methods
        .isApprovedForAll(account, addresses.orderBook)
        .call();
      setHasApprovalForAll(approved);
    } catch (error) {
      console.error('检查授权状态失败:', error);
    }
  };

  if (!account) {
    return (
      <div className="my-tickets-container">
        <div className="warning">请先连接钱包</div>
      </div>
    );
  }

  return (
    <div className="my-tickets-container">
      <div className="my-tickets-card">
        <button onClick={() => window.location.href = '/'} className="back-btn">
          ← 返回
        </button>

        <h1>我的彩票</h1>

        {/* 添加刷新按钮 */}
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={() => {
              console.log('手动刷新彩票列表');
              loadTickets();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新列表
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-state">
            您还没有彩票
            <br />
            <small style={{ color: '#666', fontSize: '12px', marginTop: '10px', display: 'block' }}>
              提示：如果刚刚购买了彩票，请点击"刷新列表"按钮，或等待几秒自动刷新
            </small>
          </div>
        ) : (
          <div className="tickets-list">
            {tickets.map((ticket) => {
              const order = getOrderForTicket(ticket.tokenId);
              return (
                <div key={ticket.tokenId} className="ticket-item">
                  <div className="ticket-info">
                    <h3>彩票 #{ticket.tokenId}</h3>
                    <p>项目ID: {ticket.projectId}{ticket.projectTitle ? ` - ${ticket.projectTitle}` : ''}</p>
                    <p>选项索引: {ticket.optionIndex}{ticket.optionName ? ` (${ticket.optionName})` : ''}</p>
                    <p>购买价格: {web3.utils.fromWei(ticket.purchasePrice, 'ether')} ETH</p>
                    <p>购买时间: {new Date(ticket.purchaseTime * 1000).toLocaleString('zh-CN')}</p>
                    {ticket.projectSettled && (
                      <p className="ticket-settled">
                        项目已结算 {ticket.winningOption === ticket.optionIndex ? '（您持有获胜选项）' : '（未中奖）'}
                      </p>
                    )}
                    {order && (
                      <p className="order-status">
                        已挂单 - 价格: {web3.utils.fromWei(order.price, 'ether')} ETH
                      </p>
                    )}
                  </div>
                  <div className="ticket-actions">
                    {!order ? (
                      <div className="sell-form">
                        <input
                          type="number"
                          value={selectedTicket === ticket.tokenId ? sellPrice : ''}
                          onChange={(e) => {
                            setSelectedTicket(ticket.tokenId);
                            setSellPrice(e.target.value);
                          }}
                          placeholder="出售价格 (ETH)"
                          min="0.1"
                          step="0.1"
                          className="price-input"
                        />
                        <button
                          onClick={() => {
                            setSelectedTicket(ticket.tokenId);
                            handleListTicket();
                          }}
                          disabled={loading || ticket.projectSettled}
                          className="sell-btn"
                        >
                          {ticket.projectSettled ? '已结算' : '挂单出售'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCancelOrder(order.orderId)}
                        disabled={loading}
                        className="cancel-order-btn"
                      >
                        取消订单
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedTicket && (
          <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>出售彩票 #{selectedTicket}</h3>
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="价格 (ETH)"
                min="0.1"
                step="0.1"
                className="modal-input"
              />
              <div className="modal-actions">
                <button onClick={() => setSelectedTicket(null)} className="cancel-btn">
                  取消
                </button>
                <button onClick={handleListTicket} disabled={loading} className="confirm-btn">
                  {loading ? '处理中...' : '确认出售'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTickets;


