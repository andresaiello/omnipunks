// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@zetachain/protocol-contracts/contracts/evm/tools/ZetaInteractor.sol";
import "@zetachain/protocol-contracts/contracts/evm/interfaces/ZetaInterfaces.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./PunksV1Contract.sol";

import "hardhat/console.sol";

contract CriptopunksPunkStrategy {
    address payable public punkAddress = payable(0x6Ba6f2207e343923BA692e5Cae646Fb0F566DB8D);

    function wrapPunkStrategy(uint punkId) public payable virtual {
        (bool isForSale, , address seller, uint minValue, address onlySellTo) = PunksV1Contract(punkAddress)
            .punksOfferedForSale(punkId);
        require(isForSale == true);
        require(seller == msg.sender);
        require(minValue == 0);
        require((onlySellTo == address(this)) || (onlySellTo == address(0x0)));
        // Buy the punk
        PunksV1Contract(punkAddress).buyPunk{value: msg.value}(punkId);
    }

    function unwrapPunkStrategy(uint256 punkId) public virtual {
        PunksV1Contract(punkAddress).transferPunk(msg.sender, punkId);
    }
}
