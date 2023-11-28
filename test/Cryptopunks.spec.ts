import { AddressZero } from "@ethersproject/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  type Cryptopunks,
  type ZetaConnectorMock,
  type ZetaEthMock,
  type ZetaTokenConsumerMock,
  ERC721__factory,
  PunksV1Contract__factory,
} from "../typechain-types";

const hre = require("hardhat");

const PUNKS_ADDRESS = "0x6Ba6f2207e343923BA692e5Cae646Fb0F566DB8D";
const SAMPLE_PUNK_HOLDER = "0x682c303cE4C38c275cF23b38656340D6bA322832";
const SAMPLE_PUNK_ID = 9898;

const PUNKS_WRAPPED_ADDRESS = "0x282BDD42f4eb70e7A9D9F40c8fEA0825B7f68C5D";
const SAMPLE_PUNKWRAPPED_HOLDER = "0xdaE48D7b5c73a95F74CAAe08F7f92D3B7927f449";
const SAMPLE_PUNKWRAPPED_ID = 5543;

describe("Cryptopunk tests", () => {
  let owner: SignerWithAddress, friend: SignerWithAddress, addrs: SignerWithAddress[];
  let punkHolderSigner: SignerWithAddress;
  let punkWrappedHolderSigner: SignerWithAddress;

  let zetaEthMockContract: ZetaEthMock;
  let zetaConnectorMockContract: ZetaConnectorMock;
  let zetaTokenConsumerMockContract: ZetaTokenConsumerMock;
  const chainAId = 1;
  const chainBId = 2;

  let cryptopunksChainA: Cryptopunks, cryptopunksChainB: Cryptopunks;

  beforeEach(async () => {
    [owner, friend, ...addrs] = await ethers.getSigners();
    const currentChainId = await hre.ethers.provider.send("eth_chainId");

    const ZetaEthMock = await ethers.getContractFactory("ZetaEthMock");
    //@ts-ignore
    zetaEthMockContract = await ZetaEthMock.deploy(owner.address, parseEther("1000000"));

    const ZetaConnectorMock = await ethers.getContractFactory("ZetaConnectorMock");
    //@ts-ignore
    zetaConnectorMockContract = await ZetaConnectorMock.deploy();

    const ZetaTokenConsumerMock = await ethers.getContractFactory("ZetaTokenConsumerMock");
    //@ts-ignore
    zetaTokenConsumerMockContract = await ZetaTokenConsumerMock.deploy(zetaEthMockContract.address);

    const Cryptopunks = await ethers.getContractFactory("Cryptopunks");
    //@ts-ignore
    cryptopunksChainA = await Cryptopunks.deploy(
      zetaConnectorMockContract.address,
      zetaEthMockContract.address,
      zetaTokenConsumerMockContract.address,
      currentChainId
    );

    //@ts-ignore
    cryptopunksChainB = await Cryptopunks.deploy(
      zetaConnectorMockContract.address,
      zetaEthMockContract.address,
      zetaTokenConsumerMockContract.address,
      currentChainId
    );

    const encodedCrossChainAddressA = ethers.utils.solidityPack(["address"], [cryptopunksChainA.address]);
    const encodedCrossChainAddressB = ethers.utils.solidityPack(["address"], [cryptopunksChainB.address]);
    await cryptopunksChainA.setInteractorByChainId(chainBId, encodedCrossChainAddressB);
    await cryptopunksChainB.setInteractorByChainId(chainAId, encodedCrossChainAddressA);

    await zetaConnectorMockContract.setZetaReceiverChainA(cryptopunksChainA.address);
    await zetaConnectorMockContract.setZetaReceiverChainB(cryptopunksChainB.address);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAMPLE_PUNK_HOLDER],
    });
    punkHolderSigner = await ethers.getSigner(SAMPLE_PUNK_HOLDER);
    hre.network.provider.send("hardhat_setBalance", [SAMPLE_PUNK_HOLDER, parseEther("1000000").toHexString()]);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAMPLE_PUNKWRAPPED_HOLDER],
    });
    punkWrappedHolderSigner = await ethers.getSigner(SAMPLE_PUNKWRAPPED_HOLDER);
    hre.network.provider.send("hardhat_setBalance", [SAMPLE_PUNKWRAPPED_HOLDER, parseEther("1000000").toHexString()]);
  });

  describe("Cryptopunk", () => {
    it("Should wrap bridge and unwrap native cryptopunks", async () => {
      const punksV1Contract = await PunksV1Contract__factory.connect(PUNKS_ADDRESS, owner);

      await punksV1Contract
        .connect(punkHolderSigner)
        .offerPunkForSaleToAddress(SAMPLE_PUNK_ID, 0, cryptopunksChainA.address);

      const punkOwner1 = await punksV1Contract.punkIndexToAddress(SAMPLE_PUNK_ID);
      expect(punkOwner1).to.equal(punkHolderSigner.address);
      const punkOwnerOmniPunkA1 = cryptopunksChainA.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkA1).to.be.revertedWith("ERC721: invalid token ID");
      const punkOwnerOmniPunkB1 = cryptopunksChainB.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkB1).to.be.revertedWith("ERC721: invalid token ID");

      await cryptopunksChainA.connect(punkHolderSigner).wrap(SAMPLE_PUNK_ID, 0);

      const punkOwner2 = await punksV1Contract.punkIndexToAddress(SAMPLE_PUNK_ID);
      expect(punkOwner2).to.equal(cryptopunksChainA.address);
      const punkOwnerOmniPunkA2 = await cryptopunksChainA.ownerOf(SAMPLE_PUNK_ID);
      expect(punkOwnerOmniPunkA2).to.equal(punkHolderSigner.address);
      const punkOwnerOmniPunkB2 = cryptopunksChainB.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkB2).to.be.revertedWith("ERC721: invalid token ID");

      await cryptopunksChainA.connect(punkHolderSigner).bridge(chainBId, SAMPLE_PUNK_ID, punkHolderSigner.address, 0);

      const punkOwner3 = await punksV1Contract.punkIndexToAddress(SAMPLE_PUNK_ID);
      expect(punkOwner3).to.equal(cryptopunksChainA.address);
      const punkOwnerOmniPunkA3 = cryptopunksChainA.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkA3).to.be.revertedWith("ERC721: invalid token ID");
      const punkOwnerOmniPunkB3 = await cryptopunksChainB.ownerOf(SAMPLE_PUNK_ID);
      expect(punkOwnerOmniPunkB3).to.equal(punkHolderSigner.address);

      await cryptopunksChainB.connect(punkHolderSigner).bridge(chainAId, SAMPLE_PUNK_ID, punkHolderSigner.address, 0);

      const punkOwner4 = await punksV1Contract.punkIndexToAddress(SAMPLE_PUNK_ID);
      expect(punkOwner4).to.equal(cryptopunksChainA.address);
      const punkOwnerOmniPunkA4 = await cryptopunksChainA.ownerOf(SAMPLE_PUNK_ID);
      expect(punkOwnerOmniPunkA4).to.equal(punkHolderSigner.address);
      const punkOwnerOmniPunkB4 = cryptopunksChainB.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkB4).to.be.revertedWith("ERC721: invalid token ID");

      await cryptopunksChainA.connect(punkHolderSigner).unwrap(SAMPLE_PUNK_ID);

      const punkOwner5 = await punksV1Contract.punkIndexToAddress(SAMPLE_PUNK_ID);
      expect(punkOwner5).to.equal(punkHolderSigner.address);
      const punkOwnerOmniPunkA5 = cryptopunksChainA.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkA5).to.be.revertedWith("ERC721: invalid token ID");
      const punkOwnerOmniPunkB5 = cryptopunksChainB.ownerOf(SAMPLE_PUNK_ID);
      await expect(punkOwnerOmniPunkB5).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should wrap bridge and unwrap wrappedv1 cryptopunks", async () => {
      const punksV1Contract = await ERC721__factory.connect(PUNKS_WRAPPED_ADDRESS, owner);
      await punksV1Contract.connect(punkWrappedHolderSigner).approve(cryptopunksChainA.address, SAMPLE_PUNKWRAPPED_ID);

      const punkOwner1 = await punksV1Contract.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwner1).to.equal(punkWrappedHolderSigner.address);
      const punkOwnerOmniPunkA1 = cryptopunksChainA.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkA1).to.be.revertedWith("ERC721: invalid token ID");
      const punkOwnerOmniPunkB1 = cryptopunksChainB.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkB1).to.be.revertedWith("ERC721: invalid token ID");

      await cryptopunksChainA.connect(punkWrappedHolderSigner).wrap(SAMPLE_PUNKWRAPPED_ID, 1);

      const punkOwner2 = await punksV1Contract.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwner2).to.equal(cryptopunksChainA.address);
      const punkOwnerOmniPunkA2 = await cryptopunksChainA.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwnerOmniPunkA2).to.equal(punkWrappedHolderSigner.address);
      const punkOwnerOmniPunkB2 = cryptopunksChainB.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkB2).to.be.revertedWith("ERC721: invalid token ID");

      await cryptopunksChainA
        .connect(punkWrappedHolderSigner)
        .bridge(chainBId, SAMPLE_PUNKWRAPPED_ID, punkWrappedHolderSigner.address, 0);

      const punkOwner3 = await punksV1Contract.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwner3).to.equal(cryptopunksChainA.address);
      const punkOwnerOmniPunkA3 = cryptopunksChainA.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkA3).to.be.revertedWith("ERC721: invalid token ID");
      const punkOwnerOmniPunkB3 = await cryptopunksChainB.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwnerOmniPunkB3).to.equal(punkWrappedHolderSigner.address);

      await cryptopunksChainB
        .connect(punkWrappedHolderSigner)
        .bridge(chainAId, SAMPLE_PUNKWRAPPED_ID, punkWrappedHolderSigner.address, 0);

      const punkOwner4 = await punksV1Contract.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwner4).to.equal(cryptopunksChainA.address);
      const punkOwnerOmniPunkA4 = await cryptopunksChainA.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwnerOmniPunkA4).to.equal(punkWrappedHolderSigner.address);
      const punkOwnerOmniPunkB4 = cryptopunksChainB.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkB4).to.be.revertedWith("ERC721: invalid token ID");

      await cryptopunksChainA.connect(punkWrappedHolderSigner).unwrap(SAMPLE_PUNKWRAPPED_ID);

      const punkOwner5 = await punksV1Contract.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      expect(punkOwner5).to.equal(punkWrappedHolderSigner.address);
      const punkOwnerOmniPunkA5 = cryptopunksChainA.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkA5).to.be.revertedWith("ERC721: invalid token ID");
      const punkOwnerOmniPunkB5 = cryptopunksChainB.ownerOf(SAMPLE_PUNKWRAPPED_ID);
      await expect(punkOwnerOmniPunkB5).to.be.revertedWith("ERC721: invalid token ID");
    });
  });
});
