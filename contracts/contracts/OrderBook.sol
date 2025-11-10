// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./LotteryTicket.sol";
import "./BetToken.sol";

/**
 * @title OrderBook
 * @dev 链上订单簿合约，用于管理彩票交易
 * 支持按价格组织的订单簿，支持按最优价格购买
 */
contract OrderBook {
    LotteryTicket public lotteryTicket;
    BetToken public betToken;
    address public bettingPlatform;

    // 订单结构
    struct Order {
        uint256 orderId;
        address seller;
        uint256 tokenId; // ERC721 Token ID
        uint256 projectId; // 项目ID
        uint256 optionIndex; // 选项索引
        uint256 price; // 出售价格（以wei为单位）
        bool isActive; // 是否有效
        uint256 createTime; // 创建时间
    }

    // 订单映射
    mapping(uint256 => Order) public orders; // orderId => Order
    mapping(uint256 => uint256) public tokenToOrder; // tokenId => orderId
    mapping(uint256 => uint256[]) public ordersByProjectOption; // projectId_optionIndex => orderIds

    // 按价格组织的订单（用于订单簿显示）
    mapping(uint256 => mapping(uint256 => uint256[])) public priceOrders; // projectId => price => orderIds
    mapping(uint256 => uint256[]) public pricesByProject; // projectId => sorted prices

    uint256 public orderCounter;
    bool public useERC20Payment;

    // 事件
    event OrderCreated(
        uint256 indexed orderId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 projectId,
        uint256 optionIndex,
        uint256 price
    );

    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(
        uint256 indexed orderId,
        address indexed seller,
        address indexed buyer,
        uint256 tokenId,
        uint256 price
    );

    modifier onlyBettingPlatform() {
        require(msg.sender == bettingPlatform, "Only betting platform");
        _;
    }

    constructor(
        address _lotteryTicket,
        address _betToken,
        address _bettingPlatform,
        bool _useERC20Payment
    ) {
        lotteryTicket = LotteryTicket(_lotteryTicket);
        betToken = BetToken(_betToken);
        bettingPlatform = _bettingPlatform;
        useERC20Payment = _useERC20Payment;
        orderCounter = 1;
    }

    /**
     * @dev 挂单出售彩票
     * @param tokenId 彩票Token ID
     * @param price 出售价格
     */
    function listTicket(uint256 tokenId, uint256 price) external {
        require(
            lotteryTicket.ownerOf(tokenId) == msg.sender,
            "Not token owner"
        );
        require(tokenToOrder[tokenId] == 0, "Token already listed");
        require(price > 0, "Price must be greater than 0");

        // 注意：approve应该由用户在前端调用
        // 这里不检查approve，因为如果approve失败，后续购买时的transferFrom会失败
        // 这样可以避免时间窗口问题和合约调用复杂度

        uint256 orderId = orderCounter;
        orderCounter++;

        LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket
            .getTicketInfo(tokenId);

        orders[orderId] = Order({
            orderId: orderId,
            seller: msg.sender,
            tokenId: tokenId,
            projectId: ticketInfo.projectId,
            optionIndex: ticketInfo.optionIndex,
            price: price,
            isActive: true,
            createTime: block.timestamp
        });

        tokenToOrder[tokenId] = orderId;

        // 添加到项目选项的订单列表
        uint256 projectOptionKey = ticketInfo.projectId *
            1000 +
            ticketInfo.optionIndex;
        ordersByProjectOption[projectOptionKey].push(orderId);

        // 添加到价格订单簿
        priceOrders[ticketInfo.projectId][price].push(orderId);

        // 维护价格列表（简化版：不排序，前端可以排序）

        emit OrderCreated(
            orderId,
            msg.sender,
            tokenId,
            ticketInfo.projectId,
            ticketInfo.optionIndex,
            price
        );
    }

    /**
     * @dev 取消订单
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.seller == msg.sender, "Not order seller");
        require(order.isActive, "Order not active");

        order.isActive = false;
        delete tokenToOrder[order.tokenId];

        emit OrderCancelled(orderId);
    }

    /**
     * @dev 内部函数：执行订单购买逻辑
     * @param orderId 订单ID
     * @param buyer 购买者地址
     * @param paymentAmount 支付金额（仅在ETH支付时使用）
     */
    function _executeOrder(
        uint256 orderId,
        address buyer,
        uint256 paymentAmount
    ) internal {
        Order storage order = orders[orderId];
        require(order.isActive, "Order not active");
        require(order.seller != buyer, "Cannot buy own order");

        if (useERC20Payment) {
            require(paymentAmount == 0, "Should not send ETH when using ERC20");
            require(
                betToken.transferFrom(buyer, order.seller, order.price),
                "ERC20 transfer failed"
            );
        } else {
            require(paymentAmount == order.price, "Incorrect payment amount");
            payable(order.seller).transfer(order.price);
        }

        // 转移NFT
        lotteryTicket.transferFrom(order.seller, buyer, order.tokenId);

        order.isActive = false;
        delete tokenToOrder[order.tokenId];

        emit OrderFilled(
            orderId,
            order.seller,
            buyer,
            order.tokenId,
            order.price
        );
    }

    /**
     * @dev 从订单簿购买彩票（按订单ID）
     * @param orderId 订单ID
     */
    function buyFromOrderBook(uint256 orderId) external payable {
        _executeOrder(orderId, msg.sender, msg.value);
    }

    /**
     * @dev 按最优价格购买（同一项目同一选项的最低价）
     * @param projectId 项目ID
     * @param optionIndex 选项索引
     */
    function buyAtBestPrice(
        uint256 projectId,
        uint256 optionIndex
    ) external payable {
        uint256 projectOptionKey = projectId * 1000 + optionIndex;
        uint256[] memory orderIds = ordersByProjectOption[projectOptionKey];

        uint256 bestOrderId = 0;
        uint256 bestPrice = type(uint256).max;

        // 找到最低价的活跃订单
        for (uint256 i = 0; i < orderIds.length; i++) {
            Order storage order = orders[orderIds[i]];
            if (order.isActive && order.price < bestPrice) {
                bestPrice = order.price;
                bestOrderId = orderIds[i];
            }
        }

        require(bestOrderId != 0, "No active order found");
        require(
            msg.value == bestPrice || (useERC20Payment && msg.value == 0),
            "Incorrect payment amount"
        );

        _executeOrder(bestOrderId, msg.sender, msg.value);
    }

    /**
     * @dev 获取项目的订单簿信息
     * @param projectId 项目ID
     * @param optionIndex 选项索引
     * @return activeOrderIds 活跃订单ID列表
     * @return prices 对应的价格列表
     */
    function getOrderBook(
        uint256 projectId,
        uint256 optionIndex
    )
        external
        view
        returns (uint256[] memory activeOrderIds, uint256[] memory prices)
    {
        uint256 projectOptionKey = projectId * 1000 + optionIndex;
        uint256[] memory orderIds = ordersByProjectOption[projectOptionKey];

        uint256 activeCount = 0;
        for (uint256 i = 0; i < orderIds.length; i++) {
            if (orders[orderIds[i]].isActive) {
                activeCount++;
            }
        }

        activeOrderIds = new uint256[](activeCount);
        prices = new uint256[](activeCount);

        uint256 index = 0;
        for (uint256 i = 0; i < orderIds.length; i++) {
            Order storage order = orders[orderIds[i]];
            if (order.isActive) {
                activeOrderIds[index] = order.orderId;
                prices[index] = order.price;
                index++;
            }
        }
    }

    /**
     * @dev 获取订单详细信息
     */
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /**
     * @dev 获取用户的所有订单
     */
    function getUserOrders(
        address user
    ) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < orderCounter; i++) {
            if (orders[i].seller == user) {
                count++;
            }
        }

        uint256[] memory userOrders = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < orderCounter; i++) {
            if (orders[i].seller == user) {
                userOrders[index] = i;
                index++;
            }
        }

        return userOrders;
    }
}
