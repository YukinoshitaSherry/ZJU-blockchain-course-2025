// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./LotteryTicket.sol";
import "./BetToken.sol";

/**
 * @title BettingPlatform
 * @dev 去中心化彩票平台主合约
 * 管理竞猜项目、购买彩票、结算等功能
 */
contract BettingPlatform {
    LotteryTicket public lotteryTicket;
    BetToken public betToken;
    
    // 项目信息结构
    struct BettingProject {
        uint256 projectId;
        address creator;           // 公证人地址
        string title;              // 项目标题
        string[] options;          // 选项列表
        uint256 prizePool;         // 奖池金额
        uint256 deadline;          // 截止时间
        uint256 winningOption;     // 获胜选项索引（结算后设置）
        bool isSettled;            // 是否已结算
    }
    
    // 项目映射
    mapping(uint256 => BettingProject) public projects;
    mapping(uint256 => mapping(uint256 => uint256)) public optionTicketCount; // projectId => optionIndex => count
    mapping(uint256 => mapping(uint256 => address[])) public optionHolders;   // projectId => optionIndex => holders
    
    uint256 public projectCounter;
    
    // 使用ETH还是ERC20支付
    bool public useERC20Payment;
    
    // 事件
    event ProjectCreated(
        uint256 indexed projectId,
        address creator,
        string title,
        uint256 prizePool,
        uint256 deadline
    );
    
    event TicketPurchased(
        uint256 indexed projectId,
        uint256 indexed tokenId,
        address buyer,
        uint256 optionIndex,
        uint256 price
    );
    
    event ProjectSettled(
        uint256 indexed projectId,
        uint256 winningOption,
        uint256 totalWinners
    );
    
    modifier onlyCreator(uint256 projectId) {
        require(projects[projectId].creator == msg.sender, "Only creator can settle");
        _;
    }
    
    constructor(address _lotteryTicket, address _betToken, bool _useERC20Payment) {
        lotteryTicket = LotteryTicket(_lotteryTicket);
        betToken = BetToken(_betToken);
        useERC20Payment = _useERC20Payment;
        projectCounter = 1;
    }
    
    /**
     * @dev 创建竞猜项目
     * @param title 项目标题
     * @param options 选项数组
     * @param deadline 截止时间（Unix时间戳）
     */
    function createProject(
        string memory title,
        string[] memory options,
        uint256 deadline
    ) external payable {
        require(options.length >= 2, "At least 2 options required");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(msg.value > 0, "Prize pool must be greater than 0");
        
        uint256 projectId = projectCounter;
        projectCounter++;
        
        projects[projectId] = BettingProject({
            projectId: projectId,
            creator: msg.sender,
            title: title,
            options: options,
            prizePool: msg.value,
            deadline: deadline,
            winningOption: 0,
            isSettled: false
        });
        
        emit ProjectCreated(projectId, msg.sender, title, msg.value, deadline);
    }
    
    /**
     * @dev 使用ERC20代币创建项目
     */
    function createProjectWithERC20(
        string memory title,
        string[] memory options,
        uint256 deadline,
        uint256 prizeAmount
    ) external {
        require(options.length >= 2, "At least 2 options required");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(prizeAmount > 0, "Prize pool must be greater than 0");
        require(betToken.transferFrom(msg.sender, address(this), prizeAmount), "Transfer failed");
        
        uint256 projectId = projectCounter;
        projectCounter++;
        
        projects[projectId] = BettingProject({
            projectId: projectId,
            creator: msg.sender,
            title: title,
            options: options,
            prizePool: prizeAmount,
            deadline: deadline,
            winningOption: 0,
            isSettled: false
        });
        
        emit ProjectCreated(projectId, msg.sender, title, prizeAmount, deadline);
    }
    
    /**
     * @dev 购买彩票
     * @param projectId 项目ID
     * @param optionIndex 选择的选项索引
     */
    function buyTicket(uint256 projectId, uint256 optionIndex) external payable {
        BettingProject storage project = projects[projectId];
        require(!project.isSettled, "Project already settled");
        require(block.timestamp < project.deadline, "Project deadline passed");
        require(optionIndex < project.options.length, "Invalid option index");
        
        uint256 ticketPrice = 1 ether; // 固定价格1 ETH（或等值的ERC20）
        
        if (useERC20Payment) {
            require(msg.value == 0, "Should not send ETH when using ERC20");
            require(betToken.transferFrom(msg.sender, address(this), ticketPrice), "ERC20 transfer failed");
        } else {
            require(msg.value == ticketPrice, "Incorrect payment amount");
        }
        
        // 更新奖池
        if (useERC20Payment) {
            project.prizePool += ticketPrice;
        } else {
            project.prizePool += msg.value;
        }
        
        // 铸造彩票NFT
        uint256 tokenId = lotteryTicket.mint(msg.sender, projectId, optionIndex, ticketPrice);
        
        // 更新统计数据
        optionTicketCount[projectId][optionIndex]++;
        optionHolders[projectId][optionIndex].push(msg.sender);
        
        emit TicketPurchased(projectId, tokenId, msg.sender, optionIndex, ticketPrice);
    }
    
    /**
     * @dev 结算项目并分发奖金
     * @param projectId 项目ID
     * @param winningOption 获胜选项索引
     */
    function settleProject(uint256 projectId, uint256 winningOption) external onlyCreator(projectId) {
        BettingProject storage project = projects[projectId];
        require(!project.isSettled, "Project already settled");
        require(block.timestamp >= project.deadline, "Deadline not reached");
        require(winningOption < project.options.length, "Invalid winning option");
        
        project.isSettled = true;
        project.winningOption = winningOption;
        
        address[] memory winners = optionHolders[projectId][winningOption];
        uint256 winnerCount = winners.length;
        
        if (winnerCount > 0 && project.prizePool > 0) {
            uint256 prizePerWinner = project.prizePool / winnerCount;
            
            if (useERC20Payment) {
                for (uint256 i = 0; i < winnerCount; i++) {
                    require(betToken.transfer(winners[i], prizePerWinner), "Prize transfer failed");
                }
            } else {
                for (uint256 i = 0; i < winnerCount; i++) {
                    payable(winners[i]).transfer(prizePerWinner);
                }
            }
        }
        
        emit ProjectSettled(projectId, winningOption, winnerCount);
    }
    
    /**
     * @dev 获取项目信息
     */
    function getProject(uint256 projectId) external view returns (BettingProject memory) {
        return projects[projectId];
    }
    
    /**
     * @dev 获取项目的所有选项
     */
    function getProjectOptions(uint256 projectId) external view returns (string[] memory) {
        return projects[projectId].options;
    }
    
    /**
     * @dev 获取选项的购买数量
     */
    function getOptionTicketCount(uint256 projectId, uint256 optionIndex) external view returns (uint256) {
        return optionTicketCount[projectId][optionIndex];
    }
    
    /**
     * @dev 获取选项的持有者列表
     */
    function getOptionHolders(uint256 projectId, uint256 optionIndex) external view returns (address[] memory) {
        return optionHolders[projectId][optionIndex];
    }
    
    /**
     * @dev 获取所有项目ID
     */
    function getAllProjectIds() external view returns (uint256[] memory) {
        uint256[] memory projectIds = new uint256[](projectCounter - 1);
        for (uint256 i = 1; i < projectCounter; i++) {
            projectIds[i - 1] = i;
        }
        return projectIds;
    }
}


