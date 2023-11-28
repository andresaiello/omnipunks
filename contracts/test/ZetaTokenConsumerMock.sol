// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@zetachain/protocol-contracts/contracts/evm/interfaces/ZetaInterfaces.sol";
import "./ZetaEthMock.sol";

contract ZetaTokenConsumerMock is ZetaTokenConsumer {
    address public immutable zetaToken;

    constructor(address zetaToken_) {
        zetaToken = zetaToken_;
    }

    function getZetaFromEth(
        address destinationAddress,
        uint256 minAmountOut
    ) external payable override returns (uint256) {
        if (destinationAddress == address(0)) revert ZetaCommonErrors.InvalidAddress();
        ZetaEthMock(zetaToken).mint(msg.sender, msg.value);
        return msg.value;
    }

    function getZetaFromToken(
        address destinationAddress,
        uint256 minAmountOut,
        address inputToken,
        uint256 inputTokenAmount
    ) external override returns (uint256) {
        return 0;
    }

    function getEthFromZeta(
        address destinationAddress,
        uint256 minAmountOut,
        uint256 zetaTokenAmount
    ) external override returns (uint256) {
        return 0;
    }

    function getTokenFromZeta(
        address destinationAddress,
        uint256 minAmountOut,
        address outputToken,
        uint256 zetaTokenAmount
    ) external override returns (uint256) {
        return 0;
    }

    function hasZetaLiquidity() external view override returns (bool) {
        return true;
    }
}
