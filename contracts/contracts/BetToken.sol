// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BetToken
 * @dev ERC20积分代币合约
 * 用户可以通过空投领取积分，用于购买彩票和交易
 */
contract BetToken is ERC20, Ownable {
    uint256 public constant AIRDROP_AMOUNT = 10000 * 10**18; // 每次空投10000个代币
    
    constructor() ERC20("BetToken", "BET") Ownable(msg.sender) {
        // 初始总供应量：1000000个代币
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    /**
     * @dev 空投功能：用户领取积分
     */
    function airdrop() external {
        require(balanceOf(msg.sender) == 0, "Already claimed airdrop");
        _mint(msg.sender, AIRDROP_AMOUNT);
    }
    
    /**
     * @dev 管理员可以增发代币（用于测试）
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}


