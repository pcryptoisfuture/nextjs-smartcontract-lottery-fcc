//import { useMoralis, useWeb3Contract } from "react-moralis"
import { abi, contractAddresses } from "../constants"
import { useSession } from "next-auth/react"
import {
    useNetwork,
    useContractRead,
    useContractReads,
    useContractWrite,
    usePrepareContractWrite,
    useSwitchNetwork,
    useContractEvent,
} from "wagmi"
import { useEffect, useState } from "react"
import { useNotification } from "web3uikit"
import { BigNumber, ethers } from "ethers"
import { subscribe, unsubscribe, publish } from "./events"

function readContract(chain, entranceFee, numPlayers, recentWinner) {
    let lAddress = chain ? (chain.id in contractAddresses ? contractAddresses[chain.id][0] : 0) : 0

    const readConfig = {
        addressOrName: lAddress,
        contractInterface: abi,
        enabled: lAddress ? true : false,
    }

    const {
        data: dataR,
        isSuccess: isSuccess1,
        /*
            isError: isErrorR,
            isLoading: isLoadingR,
            */
        refetch: refetch1,
    } = useContractRead({
        ...readConfig,
        functionName: "getEntranceFee",
        onError(error) {
            console.log("On Contract getEntranceFee", error)
        },
        onSuccess(data) {
            console.log(
                "On Contract getEntranceFee Success",
                ethers.utils.formatUnits(data, "ether") + " ETH"
            )
            publish("lottery_getEntranceFee", { data })
        },
    })
    const { isSuccess: isSuccess2, refetch: refetch2 } = useContractRead({
        ...readConfig,
        functionName: "getNumberOfPlayers",
        onError(error) {
            console.log("On Contract getNumberOfPlayers", error)
        },
        onSuccess(data) {
            console.log("On Contract getNumberOflayers Success", data.toNumber())
            publish("lottery_getNumPlayers", { data })
        },
    })

    const { isSuccess: isSuccess3, refetch: refetch3 } = useContractRead({
        ...readConfig,
        functionName: "getRecentWinner",
        onError(error) {
            console.log("On Contract getRecentWinner", error)
        },
        onSuccess(data) {
            console.log("On Contract getRecentWinner Address Success", data)
            publish("lottery_getRecentWinner", { data })
        },
    })

    let updateUI = (refreshAll, r1, r2, r3) => {
        if (r1 || refreshAll) refetch1()
        if (r2 || refreshAll) refetch2()
        if (r3 || refreshAll) refetch3()
    }
    let isSuccessAll = isSuccess1 && isSuccess2 && isSuccess3
    return { dataR, lAddress, updateUI, isSuccessAll }
}

function writeContract(dataR, lotteryAddress, handleNewNotification) {
    const {
        config: writeConfig,
        error: prepareError,
        isError: isPrepareError,
        isLoading: isPrepareLoading,
        isFetching: isPrepareFetching,
    } = usePrepareContractWrite({
        addressOrName: lotteryAddress,
        contractInterface: abi,
        functionName: "enterRaffle",
        overrides: {
            value: dataR,
        },
    })
    const writeRC = useContractWrite({
        ...writeConfig,
        onError(error) {
            console.log(
                "On Contract enterRaffle Error - \n",
                JSON.parse(JSON.stringify(error.message)) // {code, message}
            )
        },
        onSuccess(tx) {
            ;(async () => {
                console.log("On Contract enterRaffle Success", tx) // {hash, wait}
                await tx.wait(1)
                handleNewNotification()
            })()
        },
    })

    let isBusy = isPrepareLoading || isPrepareFetching

    return { writeRC, isBusy }
}

export default function LotteryEntrace() {
    //
    // Used for logging into the WEBSITE, not into the wallet
    //
    const { data: session, status } = useSession({
        required: false,
        onUnauthenticated() {
            console.log(`Session NOT Authenticated ... redirected to Sign in Page`)
        },
    })

    switch (status) {
        case "authenticated":
            // {
            //     user: {
            //         name: string
            //         email: string
            //         image: string
            //     },
            //     expires: Date // This is the expiry of the session, not any of the tokens within the session
            // }
            console.log(`Signed in as ${session.user.email}`)
            break
        case "loading":
            //console.log("Signing in ...")
            break
        default:
        //console.log(`Signed in as ${status}`)
    }

    const dispatch = useNotification()
    const { chain } = useNetwork()
    const { chains, error, isLoading, pendingChainId, switchNetwork } = useSwitchNetwork({
        throwForSwitchChainNotSupported: true,
        onSuccess(data) {
            console.log("useSwitchNetwork Success", data)
        },
        onError(error) {
            console.log("useSwitchNetwork Error", error)
        },
    })
    //const { chainId } = useMoralis()
    const [chainId, setChainId] = useState(0)
    const [hideButton, setHideButton] = useState(true)
    const [entranceFee, setEntranceFee] = useState(BigNumber.from("0"))
    const [numPlayers, setNumPlayers] = useState(0)
    const [recentWinner, setRecentWinner] = useState("")
    const [lotteryConnector, setLotteryConnector] = useState(null)
    const [isSSR, setIsSSR] = useState(true)

    const {
        dataR,
        lAddress: lotteryAddress,
        updateUI,
        isSuccessAll,
    } = readContract(chain, entranceFee, numPlayers, recentWinner)

    const { writeRC, isBusy } = writeContract(dataR, lotteryAddress, (type, icon, position) => {
        updateUI(true)
        dispatch({
            type: "info",
            message: "Transaction Complete!",
            title: "Transaction Notification",
            icon: "bell",
            position: "topR",
        })
    })

    useContractEvent({
        addressOrName: lotteryAddress,
        contractInterface: abi,
        eventName: "WinnerPicked",
        once: true,
        listener: (event) => {
            console.log("WinnerPicked - ", event, "numPlayers = ", numPlayers)
            // Prevent old events from coming through the queue ...
            if (numPlayers == 0) return

            // Notify User
            dispatch({
                type: "info",
                message: "Winner Picked! " + event[1].args["winner"],
                title: "Lottery Notification",
                icon: "bell",
                position: "topR",
            })
            // Update Stats on screen
            publish("lottery_getNumPlayers", { data: 0 })
            publish("lottery_getRecentWinner", { data: event[1].args["winner"] })
            // updateUI(false,false,true,true)
        },
    })

    useEffect(() => {
        if (!chain) return

        let cchainId = chain?.id ?? -1
        if (cchainId != chainId) setChainId(cchainId)

        // Only care about contracts on valid networks
        if (!lotteryAddress) {
            console.log(`Invalid Chain ID detected: ${chain.id}`)
            setHideButton(true)

            // Only switchNetwork if Connector is avail
            if (lotteryConnector) {
                console.log(`Optional2: Switching back to Hardhat Chain ID,`)
                //switchNetwork(31337)
            }
        } else {
            console.log(`Chain ID : ${chain.id}`)
        }
    }, [chain])

    useEffect(() => {
        if (chainId == 0) return

        console.log(`Chain ID Choosen: ${chainId}`)
        subscribe("web3_onConnect", (e) => {
            setLotteryConnector(e.detail.connector)
            console.log(
                "web3_onConnect : Contract Address - ",
                lotteryAddress,
                ", Connected to Wallet Address",
                e.detail.address,
                ", e.detail.connector ",
                lotteryConnector
            )
            /*
                if (lotteryAddress) {
                    //refetch1()
                } else if (switchNetwork) {
                    //console.log(`Optional1. Switching back to Hardhat Chain ID,`)
                    //switchNetwork(31337)
                }
                */
        })
        subscribe("web3_onDisconnect", (e) => {
            setLotteryConnector(null)
            setHideButton(true)
        })

        subscribe("lottery_getEntranceFee", (e) => {
            //console.log("lottery_getEntranceFee")
            setEntranceFee(e.detail.data)
            setHideButton(false)
        })
        subscribe("lottery_getNumPlayers", (e) => {
            //console.log("lottery_getNumPlayers")
            setNumPlayers(e.detail.data.toString())
        })
        subscribe("lottery_getRecentWinner", (e) => {
            //console.log("lottery_getRecentWinner")
            setRecentWinner(e.detail.data)
        })

        return () => {
            console.log("Effect Cleanup")
            unsubscribe("web3_onConnect")
            unsubscribe("web3_onDisconnect")

            unsubscribe("lottery_getEntranceFee")
            unsubscribe("lottery_getNumPlayers")
            unsubscribe("lottery_getRecentWinner")
        }
    }, [chainId])

    // Needed to get rid of Hydration UI error keep popping up
    // https://github.com/vercel/next.js/discussions/35773
    useEffect(() => {
        setIsSSR(false)
    }, [])

    // Have a function to enter the Lottery
    return (
        <div className="p-5">
            Lottery
            <div>
                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-auto"
                    disabled={
                        !writeRC?.write ||
                        !isSuccessAll ||
                        isBusy ||
                        writeRC?.isFetching ||
                        writeRC?.isLoading
                    }
                    hidden={hideButton}
                    onClick={() => writeRC?.write?.()}
                >
                    {isBusy || writeRC?.isFetching || writeRC?.isLoading ? (
                        <div className="animate-spin spinner-border h-8 w-8 border-b-2 rounded-full"></div>
                    ) : (
                        <div>Enter Lottery</div>
                    )}
                </button>
                {!isSSR && lotteryAddress ? (
                    <div>
                        <div>
                            Entrance Fee: {ethers.utils.formatUnits(entranceFee, "ether")} ETH
                        </div>
                        <div>Number of Players: {numPlayers}</div>
                        <div>Recent Winners : {recentWinner}</div>
                    </div>
                ) : (
                    <div>Please connect to wallet</div>
                )}
            </div>
        </div>
    )
}
