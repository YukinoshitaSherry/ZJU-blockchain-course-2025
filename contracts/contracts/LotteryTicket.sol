// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LotteryTicket
 * @dev ERC721合约，用于代表彩票凭证
 * 每个Token代表一张彩票，包含项目ID和选项信息
 */
contract LotteryTicket is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    // 彩票信息结构
    struct TicketInfo {
        uint256 projectId; // 所属项目ID
        uint256 optionIndex; // 选择的选项索引
        uint256 purchasePrice; // 购买价格
        uint256 purchaseTime; // 购买时间
    }

    mapping(uint256 => TicketInfo) public ticketInfo;

    // 只有主合约可以铸造
    address public bettingPlatform;

    modifier onlyBettingPlatform() {
        require(
            msg.sender == bettingPlatform,
            "Only betting platform can mint"
        );
        _;
    }

    constructor() ERC721("LotteryTicket", "LOT") Ownable(msg.sender) {
        _tokenIdCounter = 1;
    }

    /**
     * @dev 设置主合约地址
     */
    function setBettingPlatform(address _platform) external onlyOwner {
        bettingPlatform = _platform;
    }

    /**
     * @dev 铸造彩票NFT
     * @param to 接收者地址
     * @param projectId 项目ID
     * @param optionIndex 选项索引
     * @param purchasePrice 购买价格
     * @return tokenId 新铸造的Token ID
     */
    function mint(
        address to,
        uint256 projectId,
        uint256 optionIndex,
        uint256 purchasePrice
    ) external onlyBettingPlatform returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _mint(to, tokenId);

        ticketInfo[tokenId] = TicketInfo({
            projectId: projectId,
            optionIndex: optionIndex,
            purchasePrice: purchasePrice,
            purchaseTime: block.timestamp
        });

        return tokenId;
    }

    /**
     * @dev 获取彩票信息
     */
    function getTicketInfo(
        uint256 tokenId
    ) external view returns (TicketInfo memory) {
        return ticketInfo[tokenId];
    }

    /**
     * @dev 获取用户拥有的所有彩票
     */
    function getUserTickets(
        address user
    ) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(user);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;

        // 简单实现：遍历所有可能的tokenId（实际生产环境应使用更高效的方法）
        for (uint256 i = 1; i < _tokenIdCounter && index < balance; i++) {
            if (_ownerOf(i) == user) {
                tokens[index] = i;
                index++;
            }
        }

        return tokens;
    }
}
