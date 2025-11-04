import React, { useState, useEffect } from 'react';
import { web3, bettingPlatformContract } from '../utils/contracts';
import './CreateProject.css';

const CreateProject: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [deadline, setDeadline] = useState<string>('');
  const [prizePool, setPrizePool] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    initCheckAccounts();
  }, []);

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

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    } else {
      alert('至少需要2个选项');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      alert('请先连接钱包');
      return;
    }

    if (!title.trim()) {
      alert('请输入项目标题');
      return;
    }

    const validOptions = options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      alert('至少需要2个有效选项');
      return;
    }

    const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
    if (deadlineTimestamp <= Date.now() / 1000) {
      alert('截止时间必须是将来的时间');
      return;
    }

    setLoading(true);
    try {
      const prizeAmount = web3.utils.toWei(prizePool, 'ether');
      
      await bettingPlatformContract.methods
        .createProject(title, validOptions, deadlineTimestamp)
        .send({
          from: account,
          value: prizeAmount,
          gas: 3000000
        });

      alert('项目创建成功！');
      window.location.href = '/';
    } catch (error: any) {
      alert('创建失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-project-container">
      <div className="create-project-card">
        <h2>创建竞猜项目</h2>
        
        {!account ? (
          <div className="warning">
            请先连接钱包
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>项目标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如: NBA总冠军"
                required
              />
            </div>

            <div className="form-group">
              <label>选项</label>
              {options.map((option, index) => (
                <div key={index} className="option-input">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`选项 ${index + 1}`}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="remove-btn"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOption} className="add-option-btn">
                + 添加选项
              </button>
            </div>

            <div className="form-group">
              <label>奖池金额 (ETH)</label>
              <input
                type="number"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                min="0.1"
                step="0.1"
                required
              />
            </div>

            <div className="form-group">
              <label>截止时间</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => window.location.href = '/'} className="cancel-btn">
                取消
              </button>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? '创建中...' : '创建项目'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateProject;


