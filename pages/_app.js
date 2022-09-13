import "../styles/globals.css"

// import { MoralisProvider } from "react-moralis"
import { createClient, configureChains, defaultChains, WagmiConfig, chain } from "wagmi"
import { publicProvider } from "wagmi/providers/public"
import { SessionProvider } from "next-auth/react"
import { NotificationProvider } from "web3uikit"
import { ConnectKitProvider, getDefaultClient } from "connectkit"

const hardhatId = process.env.HARDHAT_ID
const cchains = [
    chain.hardhat, //Top of the list for first default choice
    chain.mainnet,
    chain.polygon,
    chain.ropsten,
    chain.rinkeby,
    chain.goerli,
    chain.kovan,
    chain.sepolia,
]

const { provider, webSocketProvider, chains } = configureChains(cchains, [publicProvider()])

const client = createClient(
    getDefaultClient({
        appName: "Smart Contract Lottery",
        hardhatId,
        chains,
    })
)

function MyApp({ Component, pageProps }) {
    let options = {
        embedGoogleFonts: true,
        //avoidLayoutShift: false,
        //walletConnectName: "Wallet Connect",
        disclaimer: (
            <>
                By connecting your wallet you agree to the{" "}
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://en.wikipedia.org/wiki/Terms_of_service"
                >
                    Terms of Service
                </a>{" "}
                and{" "}
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://en.wikipedia.org/wiki/Privacy_policy"
                >
                    Privacy Policy
                </a>
            </>
        ),
    }

    return (
        <WagmiConfig client={client}>
            <SessionProvider session={pageProps.session} refetchInterval={0}>
                <ConnectKitProvider theme="auto" mode="auto" options={options}>
                    <NotificationProvider>
                        <Component {...pageProps} />
                    </NotificationProvider>
                </ConnectKitProvider>
            </SessionProvider>
        </WagmiConfig>
    )
}

// function MyApp({ Component, pageProps }) {
//     return (
//         <MoralisProvider initializeOnMount={false}>
//             <NotificationProvider>
//                 <Component {...pageProps} />
//             </NotificationProvider>
//         </MoralisProvider>
//     )
// }

export default MyApp
