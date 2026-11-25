import {
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  isAddressEqual,
  parseEventLogs,
  toFunctionSignature,
} from "viem";
import {
  getPublicClient,
  getWalletClient,
  parseTransactionOptions,
  sendTransaction,
} from "./ethutil.js";

const DEFAULT_GAS = 2000000;
const DEFAULT_GAS_PRICE = 2000000000;
const RECEIPT_TIMEOUT_MS = 750000;

// The contract that players use in the console. `defaults` are transaction options.
export async function getContractAt(artifact, address, defaults = {}) {
  address = getAddress(address);
  const code = await getPublicClient().getCode({ address });
  if (!code) throw new Error(`No contract code at ${address}`);
  return createContract(artifact.abi, address, defaults);
}

export async function deployContract(artifact, args, options) {
  const data = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args,
  });
  const receipt = await sendAndWait({ data, ...getSendOptions(options) });
  return getContractAt(artifact, receipt.contractAddress, { from: options.from });
}

function createContract(abi, address, defaults) {
  const contract = { address, abi, methods: {} };

  contract.sendTransaction = (options = {}) =>
    sendAndWait({ to: address, ...getSendOptions({ ...defaults, ...options }) });

  for (const item of abi) {
    if (item.type !== "function") continue;
    const method = createMethod(item, address, defaults);
    contract.methods[toFunctionSignature(item)] = method;
    // A name that is already taken, such as an overload, is only in `methods`.
    if (!(item.name in contract)) contract[item.name] = method;
  }
  return contract;
}

function createMethod(item, address, defaults) {
  const call = async (...args) => {
    const options = { from: defaults.from, ...takeOptions(item, args) };
    const { from, ...callOptions } = parseTransactionOptions(options);
    const { result } = await getPublicClient().simulateContract({
      account: from,
      ...callOptions,
      address,
      abi: [item],
      functionName: item.name,
      args,
    });
    return result;
  };

  const send = async (...args) => {
    const options = { ...defaults, ...takeOptions(item, args) };
    const data = encodeFunctionData({ abi: [item], functionName: item.name, args });
    return sendAndWait({ ...getSendOptions(options), to: address, data });
  };

  const isView = item.stateMutability === "view" || item.stateMutability === "pure";
  const method = (...args) => (isView ? call(...args) : send(...args));
  method.call = call;
  method.sendTransaction = send;
  return method;
}

// Removes the transaction options, which follow the arguments of the function, from `args`.
function takeOptions(item, args) {
  if (args.length !== item.inputs.length + 1) return {};
  const last = args.at(-1);
  // viem reports any other extra argument.
  if (last === null || typeof last !== "object" || Array.isArray(last)) return {};
  return args.pop();
}

function getSendOptions(options) {
  const hasDynamicFee =
    options.maxFeePerGas !== undefined || options.maxPriorityFeePerGas !== undefined;
  const { gasPrice, ...otherOptions } = options;
  return {
    ...otherOptions,
    gas: options.gas || DEFAULT_GAS,
    ...(hasDynamicFee ? {} : { gasPrice: gasPrice || DEFAULT_GAS_PRICE }),
  };
}

async function sendAndWait(options) {
  const hash = await sendTransaction(options);
  let replacement;
  const receipt = await getPublicClient().waitForTransactionReceipt({
    hash,
    timeout: RECEIPT_TIMEOUT_MS,
    onReplaced: (details) => {
      replacement = details;
    },
  });
  // A repriced transaction does the same with another gas price.
  if (replacement && replacement.reason !== "repriced") {
    throw new Error(`Transaction ${hash} was ${replacement.reason}`);
  }
  if (receipt.status !== "success") {
    const reason = await getRevertReason(options, receipt);
    throw new Error(`Transaction ${hash} reverted: ${reason}`);
  }
  return receipt;
}

// A receipt has no revert reason, so the transaction is repeated as a call.
async function getRevertReason(options, receipt) {
  const { from, to, data, value, gas } = parseTransactionOptions(options);
  try {
    await getPublicClient().call({
      account: from ?? getWalletClient().account,
      to,
      data,
      value,
      gas,
      blockNumber: receipt.blockNumber,
    });
    return "no reason";
  } catch (error) {
    return error.details || error.shortMessage;
  }
}

export function getCreatedInstance(ethernaut, receipt) {
  const [log] = parseEventLogs({
    abi: ethernaut.abi,
    eventName: "LevelInstanceCreatedLog",
    logs: receipt.logs,
  });
  return log?.args.instance;
}

export function isLevelCompleted(ethernaut, receipt, player, levelAddress) {
  const [log] = parseEventLogs({
    abi: ethernaut.abi,
    eventName: "LevelCompletedLog",
    logs: receipt.logs,
  });
  if (!log) return false;
  return (
    isAddressEqual(log.args.player, player) &&
    isAddressEqual(log.args.level, levelAddress)
  );
}
