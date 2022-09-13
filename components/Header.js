// import { ConnectButton } from "web3uikit"
import { ConnectKitButton } from "connectkit"

import { useAccount } from "wagmi"
import { useState } from "react"
import { publish } from "./events"

export default function Header() {
    const {
        address,
        connector,
        isConnecting,
        isReconnecting,
        isConnected,
        isDisconnected,
        status, // : 'connecting' | 'reconnecting' | 'connected' | 'disconnected'
    } = useAccount({
        onConnect({ address, connector, isReconnected }) {
            console.log("Connected to ", { address, connector, isReconnected })
            publish("web3_onConnect", { address, connector, isReconnected })
        },
        onDisconnect() {
            console.log("Disconnected")
            publish("web3_onDisconnect")
        },
    })

    return (
        <nav className="p-5 border-b-2 flex flex-row">
            <h1 className="py-4 px-4 font-bold text-3xl"> Decentralized Lottery</h1>
            <div className="ml-auto py-2 px-4">
                <ConnectKitButton showBalance="true" showAvatar="true" label="Connect Wallet" />
            </div>
        </nav>
    )
}
