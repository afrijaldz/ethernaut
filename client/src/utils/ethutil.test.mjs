// Run with: node --test client/src/utils/ethutil.test.mjs
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import * as ethutil from "./ethutil.js";

const PLAYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OTHER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const HASH = `0x${"ab".repeat(32)}`;

class FakeProvider extends EventEmitter {
  accounts = [PLAYER.toLowerCase()];
  answers = {
    eth_chainId: () => "0x14a34",
    eth_accounts: () => this.accounts,
    eth_blockNumber: () => "0x10",
    eth_gasPrice: () => "0x64",
    eth_getBalance: () => "0xde0b6b3a7640000",
    eth_sendTransaction: () => HASH,
    eth_getBlockByNumber: () => ({
      number: "0x10",
      baseFeePerGas: "0xa",
      transactions: [],
    }),
  };

  request = mock.fn(async ({ method, params }) => {
    if (!this.answers[method]) throw new Error(`Unexpected method ${method}`);
    return this.answers[method](params);
  });
}

let provider;

beforeEach(() => {
  provider = new FakeProvider();
  ethutil.connectProvider(provider, 84532, PLAYER);
});

afterEach(() => mock.timers.reset());

// Runs the pending promises of a request.
const settle = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

describe("console helpers", () => {
  it("read from the wallet provider", async () => {
    assert.equal(await ethutil.getBalance(PLAYER), "1");
    assert.equal(await ethutil.getBlockNumber(), 16);
    assert.equal(await ethutil.getNetworkId(), 84532);
  });

  it("convert units", () => {
    assert.equal(ethutil.toWei("0.001"), 10n ** 15n);
    assert.equal(ethutil.toWei(1), 10n ** 18n);
    assert.equal(ethutil.fromWei("1500000000000000000"), "1.5");
    assert.equal(ethutil.fromWei(10n ** 18n), "1");
    assert.equal(ethutil.fromWei(0n), "0");
  });

  it("send a transaction and return its hash", async () => {
    assert.equal(
      await ethutil.sendTransaction({ to: OTHER, value: "10", gas: 21000 }),
      HASH
    );
    assert.deepEqual(provider.request.mock.calls[0].arguments[0].params, [
      { from: PLAYER, to: OTHER, value: "0xa", gas: "0x5208" },
    ]);
  });
});

describe("connectProvider", () => {
  it("uses the last provider", async () => {
    const second = new FakeProvider();
    second.answers.eth_getBalance = () => "0x0";
    ethutil.connectProvider(second, 84532, OTHER);
    assert.equal(await ethutil.getBalance(PLAYER), "0");
    assert.equal(provider.request.mock.callCount(), 0);
  });

  it("gives the player a wallet client that can send", async () => {
    const client = ethutil.getWalletClient();
    assert.equal(client.account.address, PLAYER);
    assert.equal(await client.sendTransaction({ to: OTHER, value: 1n }), HASH);
  });

  it("does not add listeners to the wallet provider", async () => {
    await ethutil.getBalance(PLAYER);
    await ethutil.sendTransaction({ to: OTHER });
    assert.deepEqual(provider.eventNames(), []);
  });
});

describe("gas fees", () => {
  it("multiply the gas price", async () => {
    assert.deepEqual(await ethutil.getGasFeeDetails(84532, 2), { gasPrice: 200n });
  });

  it("multiply the base fee on EIP-1559 networks", async () => {
    assert.deepEqual(await ethutil.getGasFeeDetails(11155111, 10), {
      maxPriorityFeePerGas: 2500000000n,
      maxFeePerGas: 2500000100n,
    });
  });
});

describe("watchers", () => {
  it("report each account change once", async () => {
    mock.timers.enable({ apis: ["setInterval"] });
    const callback = mock.fn();
    ethutil.watchAccountChanges(callback, PLAYER);
    mock.timers.tick(1000);
    await settle();
    assert.equal(callback.mock.callCount(), 0);

    provider.accounts = [OTHER.toLowerCase()];
    mock.timers.tick(1000);
    await settle();
    mock.timers.tick(1000);
    await settle();
    assert.deepEqual(
      callback.mock.calls.map((call) => call.arguments),
      [[OTHER]]
    );

    provider.accounts = [];
    mock.timers.tick(1000);
    await settle();
    assert.deepEqual(callback.mock.calls[1].arguments, [undefined]);
    assert.deepEqual(provider.eventNames(), []);
  });

  it("report the network", async () => {
    mock.timers.enable({ apis: ["setInterval"] });
    const networkId = mock.fn();
    const gasPrice = mock.fn();
    const blockNum = mock.fn();
    ethutil.watchNetwork({ networkId, gasPrice, blockNum });
    await settle();
    assert.deepEqual(networkId.mock.calls[0].arguments, [84532]);
    assert.deepEqual(gasPrice.mock.calls[0].arguments, [100n]);
    assert.deepEqual(blockNum.mock.calls[0].arguments, [16]);

    provider.answers.eth_chainId = () => "0x1";
    mock.timers.tick(5000);
    await settle();
    assert.deepEqual(networkId.mock.calls[1].arguments, [1]);
  });
});

describe("validateAddress", () => {
  it("accepts checksummed, lowercase and uppercase addresses", () => {
    assert.equal(ethutil.validateAddress(PLAYER), true);
    assert.equal(ethutil.validateAddress(PLAYER.toLowerCase()), true);
    assert.equal(ethutil.validateAddress(`0x${PLAYER.slice(2).toUpperCase()}`), true);
  });

  it("rejects a wrong checksum and the zero address", () => {
    assert.equal(ethutil.validateAddress(PLAYER.replace("0xf", "0xF")), false);
    assert.equal(ethutil.validateAddress(`0x${"0".repeat(40)}`), false);
    assert.equal(ethutil.validateAddress(""), false);
  });
});
