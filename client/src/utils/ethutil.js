import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatEther,
  formatTransactionRequest,
  getAddress,
  parseEther,
  parseGwei,
} from 'viem';
import * as constants from "../constants.js";
import { NETWORKS_INGAME } from '../constants.js'

const POLLING_INTERVAL_MS = 1000;
const QUANTITY_OPTIONS = ['value', 'gas', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas'];

let publicClient;
let walletClient;

// Both clients send their requests to the provider of the selected wallet.
export const connectProvider = (provider, chainId, account) => {
  const chain = defineChain({
    id: chainId,
    name: constants.ID_TO_NETWORK[chainId] || `chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });
  publicClient = createPublicClient({
    chain,
    transport: custom(provider),
    pollingInterval: POLLING_INTERVAL_MS,
  });
  // No retries: the wallet can already have the transaction when the response is lost.
  walletClient = createWalletClient({
    account,
    chain,
    transport: custom(provider, { retryCount: 0 }),
  });
}

export const getPublicClient = () => publicClient;

export const getWalletClient = () => walletClient;

// Players write quantities as numbers, strings or bigints.
export const parseTransactionOptions = (options) => {
  const parsed = { ...options };
  for (const name of QUANTITY_OPTIONS) {
    if (parsed[name] !== undefined) parsed[name] = BigInt(parsed[name]);
  }
  return parsed;
}

export const getBalance = async (address) =>
  formatEther(await publicClient.getBalance({ address }));

export const getBlockNumber = async () => Number(await publicClient.getBlockNumber());

// Returns the transaction hash. A wallet rejection is thrown with its code 4001.
export const sendTransaction = async (options) => {
  // walletClient.sendTransaction asks some wallets a second time after an error, with
  // another RPC method.
  return walletClient.request({
    method: 'eth_sendTransaction',
    params: [
      formatTransactionRequest({
        from: walletClient.account?.address,
        ...parseTransactionOptions(options),
      }),
    ],
  });
}

export const getNetworkId = () => publicClient.getChainId();

export const toWei = (ether) => parseEther(String(ether));

export const fromWei = (wei) => formatEther(BigInt(wei));

export const watchAccountChanges = (callback, lastKnownAccount) => {
  setInterval(async () => {
    try {
      const [newAccount] = await walletClient.getAddresses();
      if (newAccount === lastKnownAccount) return;
      lastKnownAccount = newAccount;
      callback(newAccount);
    } catch (error) {
      console.log(error);
    }
  }, 1000)
}

export const watchNetwork = (callbacks) => {
  watchValue(() => publicClient.getGasPrice(), callbacks.gasPrice, 30 * 60000);
  watchValue(getNetworkId, callbacks.networkId, 5 * 1000);
  watchValue(getBlockNumber, callbacks.blockNum, 10 * 1000);
}

const watchValue = (read, callback, interval) => {
  if (!callback) return;
  const update = async () => {
    try {
      callback(await read());
    } catch (error) {
      console.log(error);
    }
  }
  update();
  setInterval(update, interval);
}

export const validateAddress = (address) => {
  if (!address) return false;
  if (address === '0x0000000000000000000000000000000000000000') return false;
  if (address.substring(0, 2) !== "0x") return false;

  // Basic validation: length, valid characters, etc
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) return false;

  // Checksum validation.
  const raw = address.replace('0x', '');
  const allLowerCase = raw.toLowerCase() === raw;
  const allUppercase = raw.toUpperCase() === raw;
  if (allLowerCase || allUppercase) {
    return true; // accepts address with no checksum data
  }
  else {
    const checksum = getAddress(address);
    if (address !== checksum) return false;
  }

  return true;
}

export const getGasFeeDetails = async (networkId, multiplier) => {
  if (constants.SUPPORTS_EIP_1559.includes(networkId.toString())) {
    const maxPriorityFeePerGas = parseGwei('2.5');
    const block = await publicClient.getBlock();
    return {
      maxPriorityFeePerGas,
      maxFeePerGas: BigInt(multiplier) * (block.baseFeePerGas || 1n) + maxPriorityFeePerGas
    }
  } else {
    return {
      gasPrice: BigInt(multiplier) * (await publicClient.getGasPrice())
    }
  }
}

export const getNetworkFromId = (networkId) => {
  const networkObjectsList = Object.values(NETWORKS_INGAME);
  for (let network of networkObjectsList)
    if (network && network.id === networkId.toString())
      return network;
}
