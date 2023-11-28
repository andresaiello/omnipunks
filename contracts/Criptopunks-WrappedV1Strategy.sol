// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract CriptopunksWrappedV1Strategy {
    address public immutable wrappedPunksV1Address = 0x282BDD42f4eb70e7A9D9F40c8fEA0825B7f68C5D;

    function wrapWrappedV1Strategy(uint punkId) public virtual {
        ERC721(wrappedPunksV1Address).safeTransferFrom(msg.sender, address(this), punkId);
    }

    function unwrapWrappedV1Strategy(uint256 punkId) public virtual {
        ERC721(wrappedPunksV1Address).safeTransferFrom(address(this), msg.sender, punkId);
    }
}
