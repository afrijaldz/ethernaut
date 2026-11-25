// Run with: node --test client/src/utils/ethutil.test.mjs
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { beforeEach, describe, it } from "node:test";
import Web3 from "web3";
import * as ethutil from "./ethutil.js";

const PLAYER = "0x0000000000000000000000000000000000000001";
const CONTRACT = "0x0000000000000000000000000000000000000002";
const HASH = `0x${"ab".repeat(32)}`;
const ZERO_HASH = `0x${"00".repeat(32)}`;
const BLOOM = `0x${"00".repeat(256)}`;
const EVENTS = ["message", "connect", "error", "disconnect"];
const VALUE_TOPIC = Web3.utils.keccak256("ValueSet(uint256)");
const WORD_SEVEN = `0x${"7".padStart(64, "0")}`;

const CONTRACT_JSON = {
  abi: [
    {
      type: "function",
      name: "value",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
    },
    {
      type: "function",
      name: "setValue",
      inputs: [{ name: "value", type: "uint256" }],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      type: "event",
      name: "ValueSet",
      anonymous: false,
      inputs: [{ name: "value", type: "uint256", indexed: false }],
    },
  ],
  bytecode: { object: "0x6000" },
};

const log = {
  address: CONTRACT,
  topics: [VALUE_TOPIC],
  data: WORD_SEVEN,
  blockNumber: "0x1",
  blockHash: HASH,
  transactionHash: HASH,
  transactionIndex: "0x0",
  logIndex: "0x0",
  removed: false,
};

const receipt = {
  transactionHash: HASH,
  transactionIndex: "0x0",
  blockHash: HASH,
  blockNumber: "0x1",
  from: PLAYER,
  to: CONTRACT,
  contractAddress: null,
  cumulativeGasUsed: "0x1",
  gasUsed: "0x1",
  logs: [log],
  logsBloom: BLOOM,
  status: "0x1",
};

const block = {
  number: "0x1",
  hash: HASH,
  parentHash: ZERO_HASH,
  gasLimit: "0x1c9c380",
  gasUsed: "0x1",
  timestamp: "0x1",
  size: "0x1",
  difficulty: "0x0",
  totalDifficulty: "0x0",
  nonce: "0x0000000000000000",
  logsBloom: BLOOM,
  miner: PLAYER,
  transactions: [],
};

// A wallet that mines a transaction in the block after it is sent.
class FakeProvider extends EventEmitter {
  isMined = false;
  sendError = null;
  subscriptionCount = 0;
  answers = {
    eth_chainId: () => "0x14a34",
    net_version: () => "84532",
    eth_getCode: () => "0x6000",
    eth_getBlockByNumber: () => block,
    eth_estimateGas: () => "0x5208",
    eth_call: () => WORD_SEVEN,
    eth_getTransactionReceipt: () => (this.isMined ? receipt : null),
    eth_unsubscribe: () => true,
    eth_subscribe: ([type]) => this.subscribe(type),
    eth_sendTransaction: () => {
      if (this.sendError) throw this.sendError;
      return HASH;
    },
  };

  subscribe(type) {
    const subscription = `0x${++this.subscriptionCount}`;
    setTimeout(() => {
      this.isMined = true;
      const result = type === "newHeads" ? block : log;
      this.emit("message", {
        type: "eth_subscription",
        data: { subscription, result },
      });
    }, 10);
    return subscription;
  }

  async request({ method, params }) {
    if (!this.answers[method]) throw new Error(`Unexpected method ${method}`);
    // web3 changes the objects that it receives, so it gets a copy.
    return structuredClone(this.answers[method](params));
  }

  // Wallets also offer this legacy method. Truffle calls it to find a revert reason.
  send(payload, callback) {
    this.request(payload).then(
      (result) => callback(null, { id: payload.id, jsonrpc: "2.0", result }),
      callback
    );
  }
}

const countListeners = (provider) =>
  EVENTS.map((event) => provider.listenerCount(event));

const getInstance = () =>
  ethutil.getTruffleContract(CONTRACT_JSON, { from: PLAYER }).at(CONTRACT);

let provider;

beforeEach(() => {
  provider = new FakeProvider();
  ethutil.setWeb3(new Web3(provider));
});

describe("getTruffleContract", () => {
  it("does not add listeners to the wallet provider", async () => {
    const before = countListeners(provider);
    assert.ok(before.every((count) => count > 0));
    for (let i = 0; i < 20; i++) {
      const instance = await getInstance();
      assert.equal((await instance.value()).toString(), "7");
    }
    assert.deepEqual(countListeners(provider), before);
  });

  it("sends a transaction and gets its receipt and logs", async () => {
    const instance = await getInstance();
    const before = countListeners(provider);
    const tx = await instance.setValue(7);
    assert.equal(tx.receipt.transactionHash, HASH);
    assert.equal(tx.receipt.status, true);
    assert.equal(tx.logs[0].event, "ValueSet");
    assert.equal(tx.logs[0].args.value.toString(), "7");
    assert.ok(provider.subscriptionCount > 0);
    assert.deepEqual(countListeners(provider), before);
  });

  it("deploys a contract", async () => {
    const Contract = ethutil.getTruffleContract(CONTRACT_JSON, { from: PLAYER });
    provider.answers.eth_getTransactionReceipt = () => ({
      ...receipt,
      to: null,
      contractAddress: CONTRACT,
      logs: [],
    });
    const before = countListeners(provider);
    const instance = await Contract.new();
    assert.equal(instance.address, CONTRACT);
    assert.deepEqual(countListeners(provider), before);
  });

  it("receives contract events", async () => {
    const instance = await getInstance();
    const event = await new Promise((resolve, reject) => {
      instance.ValueSet().on("data", resolve).on("error", reject);
    });
    assert.equal(event.args.value.toString(), "7");
  });

  it("passes a wallet rejection to the caller", async () => {
    provider.sendError = Object.assign(new Error("User rejected"), { code: 4001 });
    const instance = await getInstance();
    await assert.rejects(instance.setValue(7), {
      code: 4001,
      message: /User rejected/,
    });
  });

  it("keeps the defaults of each contract", async () => {
    const other = "0x0000000000000000000000000000000000000003";
    const first = ethutil.getTruffleContract(CONTRACT_JSON, { from: PLAYER });
    const second = ethutil.getTruffleContract(CONTRACT_JSON, { from: other });
    assert.equal(first.defaults().from, PLAYER);
    assert.equal(second.defaults().from, other);
  });

  it("uses the provider of the last web3 that was set", async () => {
    const second = new FakeProvider();
    second.answers.eth_call = () => `0x${"8".padStart(64, "0")}`;
    ethutil.setWeb3(new Web3(second));
    const instance = await getInstance();
    assert.equal((await instance.value()).toString(), "8");
  });
});
