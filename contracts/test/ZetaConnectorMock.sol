// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@zetachain/protocol-contracts/contracts/evm/interfaces/ZetaInterfaces.sol";

contract ZetaConnectorMock is ZetaConnector {
    address public zetaReceiverChainA;
    address public zetaReceiverChainB;

    function setZetaReceiverChainA(address _zetaReceiverChainA) external {
        zetaReceiverChainA = _zetaReceiverChainA;
    }

    function setZetaReceiverChainB(address _zetaReceiverChainB) external {
        zetaReceiverChainB = _zetaReceiverChainB;
    }

    function send(ZetaInterfaces.SendInput calldata input) external override {
        bytes memory destinationAddressBytes = input.destinationAddress;
        address destinationAddress;
        assembly {
            // Extract the first 20 bytes of the encoded data
            // This is where the address is stored
            destinationAddress := mload(add(destinationAddressBytes, 20))
        }

        if (input.destinationChainId == 1) {
            ZetaReceiver(zetaReceiverChainA).onZetaMessage(
                ZetaInterfaces.ZetaMessage(
                    abi.encodePacked(msg.sender),
                    2,
                    destinationAddress,
                    input.zetaValueAndGas,
                    input.message
                )
            );
        } else if (input.destinationChainId == 2) {
            ZetaReceiver(zetaReceiverChainB).onZetaMessage(
                ZetaInterfaces.ZetaMessage(
                    abi.encodePacked(msg.sender),
                    1,
                    destinationAddress,
                    input.zetaValueAndGas,
                    input.message
                )
            );
        }
    }

    function onRevert(
        address zetaTxSenderAddress,
        uint256 sourceChainId,
        bytes calldata destinationAddress,
        uint256 destinationChainId,
        uint256 remainingZetaValue,
        bytes calldata message,
        bytes32 internalSendHash
    ) external {
        ZetaReceiver(zetaTxSenderAddress).onZetaRevert(
            ZetaInterfaces.ZetaRevert(
                zetaTxSenderAddress,
                sourceChainId,
                destinationAddress,
                destinationChainId,
                remainingZetaValue,
                message
            )
        );
    }
}
