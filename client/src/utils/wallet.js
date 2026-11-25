// Discovers browser wallets (EIP-6963), offers WalletConnect next to them, and holds the wallet
// that the player selected.

import { getAddress } from "viem";
import { createWalletConnect } from "./walletconnect.js";
import { RESULT } from "./walletresult.js";

export { RESULT };

export const STORAGE_WALLET_KEY = "ethernaut_wallet";
export const BROWSER_WALLET_ID = "browser-wallet";

// EIP-1193, and the code that WalletConnect wallets use.
const USER_REJECTED_CODES = [4001, 5000];
const ANNOUNCE_TIMEOUT = 1000;

const announcedWallets = [];
const listeners = new Set();
let selectedWallet = null;
let walletConnect = null;

function notify() {
  listeners.forEach((listener) => listener());
}

// The details come from any extension, so they are not trusted.
function isValidWallet(detail) {
  return (
    typeof detail?.info?.uuid === "string" &&
    typeof detail.info.name === "string" &&
    typeof detail.info.rdns === "string" &&
    typeof detail.provider?.request === "function"
  );
}

function handleAnnouncement(event) {
  const wallet = event.detail;
  if (!isValidWallet(wallet)) return;
  if (announcedWallets.some(({ info }) => info.uuid === wallet.info.uuid)) return;
  announcedWallets.push(wallet);
  notify();
}

export function discoverWallets() {
  window.addEventListener("eip6963:announceProvider", handleAnnouncement);
  // A wallet that does not announce itself can inject window.ethereum late.
  window.addEventListener("ethereum#initialized", notify);
  window.addEventListener("load", notify);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// Without a project ID there is no WalletConnect entry.
export function enableWalletConnect(projectId, loadPackage) {
  if (!projectId) return;
  walletConnect = createWalletConnect({
    projectId,
    loadPackage,
    onSessionEnd: () => {
      if (!isWalletConnectSelected()) return;
      forgetWallet();
      window.location.reload();
    },
  });
}

function getBrowserWallets() {
  if (announcedWallets.length > 0) return [...announcedWallets];
  if (!window.ethereum) return [];
  return [
    {
      info: { uuid: BROWSER_WALLET_ID, rdns: BROWSER_WALLET_ID },
      provider: window.ethereum,
    },
  ];
}

export function getWallets() {
  return walletConnect ? [...getBrowserWallets(), walletConnect] : getBrowserWallets();
}

// Calls the listener when the list of wallets changes. Returns the unsubscribe function.
export function subscribeToWallets(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The provider of the selected wallet, or undefined when no wallet is selected.
export function getProvider() {
  return selectedWallet?.provider;
}

export function selectWallet(wallet) {
  selectedWallet = wallet;
  localStorage.setItem(STORAGE_WALLET_KEY, wallet.info.rdns);
}

function forgetWallet() {
  selectedWallet = null;
  localStorage.removeItem(STORAGE_WALLET_KEY);
}

export function isWalletConnect(wallet) {
  return Boolean(wallet) && wallet === walletConnect;
}

export function isWalletConnectSelected() {
  return isWalletConnect(selectedWallet);
}

// Ends the WalletConnect session and returns to the connection dialog.
export async function disconnectWalletConnect() {
  try {
    await walletConnect.disconnect();
  } catch (error) {
    // The wallet could not be told. Its session is replaced by the next connection.
    console.error(error);
  }
  forgetWallet();
  window.location.reload();
}

// Only an icon that is embedded as an image is safe to show.
export function getSafeIcon(info) {
  return typeof info.icon === "string" && info.icon.startsWith("data:image/")
    ? info.icon
    : null;
}

function waitForWallet(rdns) {
  const find = () => getWallets().find(({ info }) => info.rdns === rdns);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve(find());
    };
    const unsubscribe = subscribeToWallets(() => {
      if (find()) finish();
    });
    const timer = setTimeout(finish, ANNOUNCE_TIMEOUT);
    if (find()) finish();
  });
}

// Selects the remembered wallet when it still has a connected account, without a prompt.
export async function restoreWallet() {
  const rdns = localStorage.getItem(STORAGE_WALLET_KEY);
  if (!rdns) return false;
  const wallet = await waitForWallet(rdns);
  if (!wallet) return false;
  try {
    if (isWalletConnect(wallet) && !(await walletConnect.restore())) return false;
    const accounts = await wallet.provider.request({ method: "eth_accounts" });
    if (accounts.length === 0) return false;
  } catch (error) {
    console.error(error);
    return false;
  }
  selectedWallet = wallet;
  return true;
}

function isRejection(error) {
  return USER_REJECTED_CODES.includes(error?.code);
}

function getFailure(error) {
  if (isRejection(error)) return RESULT.REJECTED;
  console.error(error);
  return RESULT.FAILED;
}

// Prompts the player to connect an account of the wallet.
export async function requestAccounts(wallet) {
  if (isWalletConnect(wallet)) return walletConnect.connect();
  try {
    const accounts = await wallet.provider.request({
      method: "eth_requestAccounts",
    });
    return accounts.length > 0 ? RESULT.DONE : RESULT.FAILED;
  } catch (error) {
    return getFailure(error);
  }
}

export async function getChainId() {
  return Number(await getProvider().request({ method: "eth_chainId" }));
}

// The connected account, with checksum.
export async function getAccount() {
  const [account] = await getProvider().request({ method: "eth_accounts" });
  return account && getAddress(account);
}

async function addNetwork(provider, network) {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: `0x${Number(network.id).toString(16)}`,
        chainName: network.name,
        rpcUrls: [network.rpcUrl],
        nativeCurrency: {
          name: network.currencyName,
          symbol: network.currencySymbol,
          decimals: 18,
        },
        blockExplorerUrls: [network.blockExplorer],
      },
    ],
  });
}

// Wallets report an unknown chain with different errors, so every switch error
// except a rejection leads to adding the chain.
export async function switchNetwork(network) {
  const provider = getProvider();
  try {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${Number(network.id).toString(16)}` }],
      });
    } catch (switchError) {
      if (isRejection(switchError)) return RESULT.REJECTED;
      await addNetwork(provider, network);
    }
    const chainId = await provider.request({ method: "eth_chainId" });
    return Number(chainId) === Number(network.id) ? RESULT.DONE : RESULT.FAILED;
  } catch (error) {
    return getFailure(error);
  }
}
