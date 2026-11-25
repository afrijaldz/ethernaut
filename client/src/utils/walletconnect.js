// Connects a mobile wallet with WalletConnect.

import { RESULT } from "./walletresult.js";
import { NETWORKS_INGAME } from "../constants.js";

export const WALLET_CONNECT_ID = "walletconnect";

const { id: CHAIN_ID, rpcUrl: RPC_URL } = NETWORKS_INGAME.BASE_SEPOLIA;
const MODAL_CLOSED_MESSAGE = "Connection request reset. Please try again.";

// The provider keeps only the message of the error that the wallet sends.
function getFailure({ message }) {
  if (/(unsupported|disapproved).*chain/i.test(message)) return RESULT.WRONG_NETWORK;
  if (message === MODAL_CLOSED_MESSAGE || /reject|disapprove/i.test(message)) {
    return RESULT.REJECTED;
  }
  return RESULT.FAILED;
}

// `loadPackage` returns the module of @walletconnect/ethereum-provider. It runs only when the
// player picks WalletConnect or has a saved session. `onSessionEnd` runs when the wallet ends
// the session or the session expires.
export function createWalletConnect({ projectId, loadPackage, onSessionEnd }) {
  let provider;
  let client;
  let hasModal = false;
  let pendingConnection = null;

  async function initialize(showQrModal) {
    const { EthereumProvider } = await loadPackage();
    provider = await EthereumProvider.init({
      projectId,
      // The package sends `chains` to the wallet as optional too, so the accepted chains are
      // checked after the connection.
      optionalChains: [Number(CHAIN_ID)],
      // Every request names its chain, so the network that the wallet shows is not followed.
      optionalEvents: ["accountsChanged"],
      rpcMap: { [CHAIN_ID]: RPC_URL },
      metadata: {
        name: "The Ethernaut",
        description: "Web3/Solidity based wargame",
        url: window.location.origin,
        icons: [`${window.location.origin}/imgs/metatag.png`],
      },
      showQrModal,
      qrModalOptions: { themeMode: document.documentElement.dataset.theme },
      // Two clients cannot share the storage.
      client,
    });
    client = provider.signer.client;
    hasModal = showQrModal;
    provider.on("disconnect", onSessionEnd);
  }

  function hasAcceptedNetwork() {
    const accounts = provider.session?.namespaces.eip155?.accounts ?? [];
    return accounts.some((account) => account.startsWith(`eip155:${CHAIN_ID}:`));
  }

  // The wallet accepted the chain, so this does not prompt.
  function selectNetwork() {
    return provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${Number(CHAIN_ID).toString(16)}` }],
    });
  }

  async function openSession() {
    if (!hasModal) await initialize(true);
    // A session that was not restored cannot be used.
    if (provider.session) await provider.disconnect();
    provider.modal.setThemeMode(document.documentElement.dataset.theme);
    await provider.connect();
    if (!hasAcceptedNetwork()) {
      await provider.disconnect();
      return RESULT.WRONG_NETWORK;
    }
    await selectNetwork();
    return RESULT.DONE;
  }

  return {
    info: { uuid: WALLET_CONNECT_ID, rdns: WALLET_CONNECT_ID, name: "WalletConnect" },

    get provider() {
      return provider;
    },

    // Shows the QR code. A second call while the first one is open has the same result.
    async connect() {
      pendingConnection ??= openSession();
      try {
        return await pendingConnection;
      } catch (error) {
        const failure = getFailure(error);
        if (failure !== RESULT.REJECTED) console.error(error);
        return failure;
      } finally {
        pendingConnection = null;
      }
    },

    // Opens the saved session without a prompt.
    async restore() {
      await initialize(false);
      if (!hasAcceptedNetwork()) return false;
      await selectNetwork();
      return true;
    },

    disconnect() {
      return provider.disconnect();
    },
  };
}
