// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@zetachain/protocol-contracts/contracts/evm/tools/ZetaInteractor.sol";
import "@zetachain/protocol-contracts/contracts/evm/interfaces/ZetaInterfaces.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./Criptopunks-PunkStrategy.sol";
import "./Criptopunks-WrappedV1Strategy.sol";

import "hardhat/console.sol";

contract Cryptopunks is
    ZetaInteractor,
    ZetaReceiver,
    ERC721("Omnichain Cryptopunks", "OCP"),
    IERC721Receiver,
    CriptopunksPunkStrategy,
    CriptopunksWrappedV1Strategy
{
    error InvalidMessageType();
    error InvalidChainId();

    event CryptopunksEvent(uint256, address, address);
    event CryptopunksRevertedEvent(uint256, address, address);

    enum PunkVersion {
        Punk,
        WrappedV1
    }
    struct Punk {
        uint256 id;
        PunkVersion punkVersion;
    }

    mapping(uint => uint) tokenIds;
    mapping(uint => Punk) punks;
    uint256 public baseChain;

    bytes32 public constant CRYPTO_PUNK_MESSAGE_TYPE = keccak256("CRYPTO_PUNK");
    ZetaTokenConsumer public _zetaConsumer;
    IERC20 internal immutable _zetaToken;

    string private _baseTokenURI;

    constructor(
        address connectorAddress,
        address zetaTokenAddress,
        address zetaConsumerAddress,
        uint256 baseChain_
    ) ZetaInteractor(connectorAddress) {
        _zetaToken = IERC20(zetaTokenAddress);
        _zetaConsumer = ZetaTokenConsumer(zetaConsumerAddress);
        _baseTokenURI = "ipfs://Qma3sC19HbnWHqeLgcsQnR7Kvgus4oPQirXNH7QYBeACaq/";
        baseChain = baseChain_;
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes memory data
    ) public override returns (bytes4) {
        // Custom logic to handle the received NFT
        // ...

        return this.onERC721Received.selector;
    }

    function setTokenConsumer(address zetaConsumerAddress) external onlyOwner {
        _zetaConsumer = ZetaTokenConsumer(zetaConsumerAddress);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseTokenURI(string memory __baseTokenURI) public onlyOwner {
        _baseTokenURI = __baseTokenURI;
    }

    function wrap(uint punkId, PunkVersion punkVersion) external {
        if (block.chainid != baseChain) revert InvalidChainId();
        if (punkVersion == PunkVersion.Punk) wrapPunkStrategy(punkId);
        if (punkVersion == PunkVersion.WrappedV1) wrapWrappedV1Strategy(punkId);
        // Mint a wrapped punk
        _safeMint(msg.sender, punkId);
        punks[punkId] = Punk(punkId, punkVersion);
    }

    function unwrap(uint256 punkId) external {
        if (block.chainid != baseChain) revert InvalidChainId();
        require(_isApprovedOrOwner(msg.sender, punkId));
        _burn(punkId);
        if (punks[punkId].punkVersion == PunkVersion.Punk) unwrapPunkStrategy(punkId);
        if (punks[punkId].punkVersion == PunkVersion.WrappedV1) unwrapWrappedV1Strategy(punkId);
        delete punks[punkId];
    }

    function _mintId(address to, uint256 punkId) internal {
        _safeMint(to, punkId);
    }

    function _burnPunk(uint256 punkId) internal {
        _burn(punkId);
    }

    function bridge(uint256 destinationChainId, uint256 punkId, address to, uint256 crossChainGas) external payable {
        uint256 zetaValueAndGas = _zetaConsumer.getZetaFromEth{value: msg.value}(address(this), crossChainGas);
        _bridge(destinationChainId, punkId, to, zetaValueAndGas);
    }

    function bridgeWithZETA(
        uint256 destinationChainId,
        uint256 punkId,
        address to,
        uint256 zetaValueAndGas
    ) external payable {
        _zetaToken.transferFrom(msg.sender, address(this), zetaValueAndGas);
        _bridge(destinationChainId, punkId, to, zetaValueAndGas);
    }

    function _bridge(uint256 destinationChainId, uint256 punkId, address to, uint256 zetaValueAndGas) internal {
        require(_isApprovedOrOwner(msg.sender, punkId));
        if (!_isValidChainId(destinationChainId)) revert InvalidDestinationChainId();

        _zetaToken.approve(address(connector), zetaValueAndGas);

        _burnPunk(punkId);

        connector.send(
            ZetaInterfaces.SendInput({
                destinationChainId: destinationChainId,
                destinationAddress: interactorsByChainId[destinationChainId],
                destinationGasLimit: 300000,
                message: abi.encode(CRYPTO_PUNK_MESSAGE_TYPE, punkId, msg.sender, to, baseChain),
                zetaValueAndGas: zetaValueAndGas,
                zetaParams: abi.encode("")
            })
        );
    }

    function onZetaMessage(
        ZetaInterfaces.ZetaMessage calldata zetaMessage
    ) external override isValidMessageCall(zetaMessage) {
        (bytes32 messageType, uint256 punkId, address sender, address to, uint256 baseChain_) = abi.decode(
            zetaMessage.message,
            (bytes32, uint256, address, address, uint256)
        );
        if (baseChain_ != baseChain) revert InvalidChainId();
        if (messageType != CRYPTO_PUNK_MESSAGE_TYPE) revert InvalidMessageType();

        _mintId(to, punkId);

        emit CryptopunksEvent(punkId, sender, to);
    }

    function onZetaRevert(
        ZetaInterfaces.ZetaRevert calldata zetaRevert
    ) external override isValidRevertCall(zetaRevert) {
        (bytes32 messageType, uint256 token, address sender, address to) = abi.decode(
            zetaRevert.message,
            (bytes32, uint256, address, address)
        );

        if (messageType != CRYPTO_PUNK_MESSAGE_TYPE) revert InvalidMessageType();

        _mintId(to, token);

        emit CryptopunksRevertedEvent(token, sender, to);
    }
}
