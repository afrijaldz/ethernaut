import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddressEqual,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, NETWORKS } from "../src/constants.js";

const POLLING_INTERVAL_MS = 1000;
const RECEIPT_TIMEOUT_MS = 750000;

// The public client reads from the chain. The wallet client sends transactions from the
// operator account of the network.
export function createClients(network) {
  const isLocal = network.name === NETWORKS.LOCAL.name;
  const url = isLocal ? `${network.url}:${network.port}` : network.url;
  const operator = ADDRESSES[network.name];

  // The local node holds the operator account. A remote node holds no accounts, so
  // transactions are signed here with the operator key.
  const account = isLocal ? operator : loadOperatorAccount(network.privKey, operator);

  return {
    publicClient: createPublicClient({
      transport: http(url),
      pollingInterval: POLLING_INTERVAL_MS,
    }),
    // No retries: the node can already have the transaction when the response is lost.
    walletClient: createWalletClient({
      account,
      transport: http(url, { retryCount: 0 }),
    }),
  };
}

function loadOperatorAccount(privateKey, operator) {
  // The key in the env can have no 0x prefix.
  const account = privateKeyToAccount(
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  );
  if (!isAddressEqual(account.address, operator)) {
    throw new Error(`Cannot sign for ${operator}, the key is for ${account.address}`);
  }
  return account;
}

// The current gas price, multiplied by percent / 100.
export async function getScaledGasPrice({ publicClient }, percent) {
  return ((await publicClient.getGasPrice()) * percent) / 100n;
}

// Returns the address and ABI of a contract that is already deployed.
export async function getDeployedContract({ publicClient }, artifact, address) {
  const code = await publicClient.getCode({ address });
  if (!code) throw new Error(`No contract code at ${address}`);
  return { address, abi: artifact.abi };
}

export async function deployContract(clients, artifact, args, props) {
  const hash = await clients.walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args,
    ...(await getTransactionOptions(clients, props)),
  });
  const receipt = await waitForSuccess(clients, hash);
  // The node returns the address in lower case, the deploy data stores the checksum form.
  return getDeployedContract(clients, artifact, getAddress(receipt.contractAddress));
}

export async function sendContractTransaction(clients, contract, functionName, args, props) {
  const hash = await clients.walletClient.writeContract({
    ...contract,
    functionName,
    args,
    ...(await getTransactionOptions(clients, props)),
  });
  return waitForSuccess(clients, hash);
}

export function readContract({ publicClient }, contract, functionName, args = []) {
  return publicClient.readContract({ ...contract, functionName, args });
}

export async function readStorageSlot({ publicClient }, address, slot) {
  return BigInt(await publicClient.getStorageAt({ address, slot: toHex(slot) }));
}

// The nonce is explicit: without it viem asks the node to fill the transaction, and the
// node can then replace the gas and the gas price.
async function getTransactionOptions({ publicClient, walletClient }, { gas, gasPrice }) {
  const nonce = await publicClient.getTransactionCount({
    address: walletClient.account.address,
    blockTag: "pending",
  });
  return { gas, gasPrice, nonce, chain: null };
}

async function waitForSuccess({ publicClient }, hash) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: RECEIPT_TIMEOUT_MS,
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction ${hash} reverted`);
  }
  return receipt;
}
