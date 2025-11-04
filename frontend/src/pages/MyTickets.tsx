import React, { useState, useEffect } from 'react';
import { web3, lotteryTicketContract, orderBookContract } from '../utils/contracts';
import './MyTickets.css';

interface Ticket {
  tokenId: number;
  projectId: number;
  optionIndex: number;
  purchasePrice: string;
  purchaseTime: number;
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

  useEffect(() => {
    initCheckAccounts();
  }, []);

  useEffect(() => {
    if (account) {
      loadTickets();
      loadMyOrders();
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
      const tokenIds = await lotteryTicketContract.methods.getUserTickets(account).call();
      const ticketPromises = tokenIds.map(async (tokenId: string) => {
        const info = await lotteryTicketContract.methods.getTicketInfo(tokenId).call();
        return {
          tokenId: parseInt(tokenId),
          projectId: parseInt(info.projectId),
          optionIndex: parseInt(info.optionIndex),
          purchasePrice: info.purchasePrice,
          purchaseTime: parseInt(info.purchaseTime),
        };
      });
      const loadedTickets = await Promise.all(ticketPromises);
      setTickets(loadedTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
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

    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      alert('请输入有效的出售价格');
      return;
    }

    setLoading(true);
    try {
      const priceInWei = web3.utils.toWei(sellPrice, 'ether');
      
      // 先授权
      await lotteryTicketContract.methods
        .approve((await import('../utils/contracts')).addresses.orderBook, selectedTicket)
        .send({
          from: account,
          gas: 3000000
        });

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

        {tickets.length === 0 ? (
          <div className="empty-state">您还没有彩票</div>
        ) : (
          <div className="tickets-list">
            {tickets.map((ticket) => {
              const order = getOrderForTicket(ticket.tokenId);
              return (
                <div key={ticket.tokenId} className="ticket-item">
                  <div className="ticket-info">
                    <h3>彩票 #{ticket.tokenId}</h3>
                    <p>项目ID: {ticket.projectId}</p>
                    <p>选项索引: {ticket.optionIndex}</p>
                    <p>购买价格: {web3.utils.fromWei(ticket.purchasePrice, 'ether')} ETH</p>
                    <p>购买时间: {new Date(ticket.purchaseTime * 1000).toLocaleString('zh-CN')}</p>
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
                          disabled={loading}
                          className="sell-btn"
                        >
                          挂单出售
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


