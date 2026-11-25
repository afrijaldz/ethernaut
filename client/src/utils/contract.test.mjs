// Needs anvil on the PATH. Run with: node --test client/src/utils/contract.test.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { encodeFunctionData, getAddress, toFunctionSelector } from "viem";
import { deployContract, getContractAt, getCreatedInstance, isLevelCompleted } from "./contract.js";
import * as ethutil from "./ethutil.js";

const PLAYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OTHER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const GAS_PRICE = 3000000000;
const DEPLOY_OPTIONS = { from: PLAYER, gas: 10000000 };

const loadArtifact = (file, name = file) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../../../contracts/out/${file}.sol/${name}.json`, import.meta.url),
      "utf8"
    )
  );
const Fallback = loadArtifact("Fallback");
const UniqueNFT = loadArtifact("UniqueNFT");
const Factory = loadArtifact("LocalFactory", "Factory");
const Ethernaut = loadArtifact("Ethernaut");
const InstanceFactory = loadArtifact("InstanceFactory");
const Instance = loadArtifact("Instance");
const Statistics = loadArtifact("Statistics");

// A wallet that sends its requests to anvil, except for the methods in `answers`.
class AnvilProvider extends EventEmitter {
  requests = [];
  answers = {};

  async request({ method, params }) {
    this.requests.push({ method, params });
    if (this.answers[method]) return this.answers[method]();
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const { result, error } = await response.json();
    if (error) throw Object.assign(new Error(error.message), error);
    return result;
  }

  // The last transaction that was sent.
  get transaction() {
    return this.requests.findLast(({ method }) => method === "eth_sendTransaction").params[0];
  }
}

let anvil;
let port;
let provider;

function startAnvil() {
  return new Promise((resolve, reject) => {
    anvil = spawn("anvil", ["--port", "0"]);
    anvil.on("error", reject);
    anvil.on("exit", (code) => reject(new Error(`anvil exited with code ${code}`)));
    let output = "";
    anvil.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Listening on 127\.0\.0\.1:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
  });
}

before(async () => {
  port = await startAnvil();
});

after(() => anvil.kill());

beforeEach(() => {
  provider = new AnvilProvider();
  ethutil.connectProvider(provider, 31337, PLAYER);
});

describe("contract object", () => {
  let contract;

  beforeEach(async () => {
    const { address } = await deployContract(Fallback, [], DEPLOY_OPTIONS);
    contract = await getContractAt(Fallback, address, { from: PLAYER, gasPrice: GAS_PRICE });
  });

  const balance = () => ethutil.getPublicClient().getBalance({ address: contract.address });

  it("has the ABI and the checksum address", async () => {
    const lowercase = await getContractAt(Fallback, contract.address.toLowerCase());
    assert.equal(lowercase.address, getAddress(contract.address));
    assert.equal(contract.abi, Fallback.abi);
  });

  it("does not exist at an address without code", async () => {
    await assert.rejects(getContractAt(Fallback, OTHER), /No contract code/);
  });

  it("returns the value of a view call, with bigint integers", async () => {
    assert.equal(await contract.owner(), PLAYER);
    assert.equal(await contract.contributions(PLAYER), 1000n * 10n ** 18n);
  });

  it("accepts checksummed and lowercase addresses as arguments", async () => {
    assert.equal(await contract.contributions(PLAYER.toLowerCase()), 1000n * 10n ** 18n);
  });

  it("uses `from` in a view call", async () => {
    assert.equal(await contract.getContribution(), 1000n * 10n ** 18n);
    assert.equal(await contract.getContribution({ from: OTHER }), 0n);
    assert.equal(await contract.getContribution.call({ from: OTHER }), 0n);
  });

  for (const value of [1, "1", 1n, "0x1"]) {
    it(`sends the value ${JSON.stringify(value, (_, v) => String(v))} (${typeof value})`, async () => {
      const receipt = await contract.contribute({ value });
      assert.equal(receipt.status, "success");
      assert.equal(await balance(), 1n);
    });
  }

  it("sends the default gas settings", async () => {
    await contract.contribute();
    assert.equal(Number(provider.transaction.gas), 2000000);
    assert.equal(Number(provider.transaction.gasPrice), GAS_PRICE);
    assert.equal(provider.transaction.from, PLAYER);
  });

  it("sends the gas settings of the player", async () => {
    await contract.contribute({ gas: 100000, gasPrice: "4000000000", from: OTHER });
    assert.equal(Number(provider.transaction.gas), 100000);
    assert.equal(Number(provider.transaction.gasPrice), 4000000000);
    assert.equal(provider.transaction.from, OTHER);
  });

  it("does not add a gas price to EIP-1559 fees", async () => {
    await contract.contribute({ maxFeePerGas: 4000000000n, maxPriorityFeePerGas: 1n });
    assert.equal(provider.transaction.gasPrice, undefined);
    assert.equal(Number(provider.transaction.maxFeePerGas), 4000000000);
  });

  it("calls a state-changing function without a transaction", async () => {
    assert.equal(await contract.contribute.call({ value: 1 }), undefined);
    assert.equal(await balance(), 0n);
  });

  it("sends a transaction with method.sendTransaction", async () => {
    const receipt = await contract.contribute.sendTransaction({ value: 2 });
    assert.equal(receipt.status, "success");
    assert.equal(await balance(), 2n);
  });

  it("sends a value without data", async () => {
    await contract.contribute({ value: 1, from: OTHER });
    await contract.sendTransaction({ value: 5, from: OTHER });
    assert.equal(await balance(), 6n);
    assert.equal(await contract.owner(), OTHER);
  });

  it("sends data with a value", async () => {
    const data = encodeFunctionData({ abi: contract.abi, functionName: "contribute" });
    const receipt = await contract.sendTransaction({ data, value: 7 });
    assert.equal(receipt.status, "success");
    assert.equal(await balance(), 7n);
  });

  it("reports the reason of a revert", async () => {
    await assert.rejects(
      contract.withdraw({ from: OTHER }),
      /reverted: .*caller is not the owner/
    );
    await assert.rejects(contract.withdraw.call({ from: OTHER }), /caller is not the owner/);
  });

  it("passes a wallet rejection to the caller, without a retry", async () => {
    provider.answers.eth_sendTransaction = () => {
      throw Object.assign(new Error("User denied"), { code: 4001 });
    };
    const count = () =>
      provider.requests.filter(({ method }) => method.endsWith("_sendTransaction")).length;
    for (const send of [
      () => contract.contribute(),
      () => contract.sendTransaction({ value: 1 }),
      () => ethutil.sendTransaction({ to: OTHER, value: 1 }),
    ]) {
      const before = count();
      await assert.rejects(send(), { code: 4001, message: /User denied/ });
      assert.equal(count(), before + 1);
    }
  });

  it("does not accept an extra argument that is not an object", async () => {
    await assert.rejects(contract.contributions(PLAYER, 1), /length/);
    await assert.rejects(contract.contribute(1), /length/);
  });

  it("reports a transaction that the player cancelled in the wallet", async () => {
    const client = ethutil.getPublicClient();
    await provider.request({ method: "evm_setAutomine", params: [false] });
    try {
      const sent = contract.contribute({ value: 1 });
      const rejected = assert.rejects(sent, /was cancelled/);
      // The wait starts before the cancellation is sent.
      while (!provider.requests.some(({ method }) => method === "eth_getTransactionByHash")) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const nonce = await client.getTransactionCount({ address: PLAYER });
      await ethutil.sendTransaction({
        to: PLAYER,
        value: 0,
        gas: 21000,
        gasPrice: GAS_PRICE * 2,
        nonce,
      });
      await provider.request({ method: "evm_mine", params: [] });
      await rejected;
    } finally {
      await provider.request({ method: "evm_setAutomine", params: [true] });
    }
  });

  it("does not add listeners to the wallet provider", async () => {
    await contract.contribute({ value: 1 });
    await contract.owner();
    for (let i = 0; i < 20; i++) await getContractAt(Fallback, contract.address);
    assert.deepEqual(provider.eventNames(), []);
  });
});

describe("overloaded functions", () => {
  const SHORT = "safeTransferFrom(address,address,uint256)";
  const LONG = "safeTransferFrom(address,address,uint256,bytes)";
  let contract;

  beforeEach(async () => {
    contract = await deployContract(UniqueNFT, [], DEPLOY_OPTIONS);
    await contract.mintNFTEOA();
  });

  it("are callable by signature", async () => {
    const transfers = [
      [SHORT, [PLAYER, OTHER, 0]],
      [LONG, [PLAYER, OTHER, 0, "0x1234"]],
    ];
    for (const [signature, args] of transfers) {
      await assert.rejects(contract.methods[signature](...args), /transfers not allowed/);
      assert.ok(provider.transaction.data.startsWith(toFunctionSelector(signature)));
      await assert.rejects(contract.methods[signature].call(...args), /transfers not allowed/);
    }
  });

  it("have all other functions by signature too", async () => {
    assert.equal(await contract.methods["ownerOf(uint256)"](0), PLAYER);
    assert.equal(await contract.name(), "UniqueNFT");
  });
});

describe("game", () => {
  let ethernaut;
  let level;
  let factory;

  beforeEach(async () => {
    factory = await deployContract(Factory, [], DEPLOY_OPTIONS);
    level = await deployContract(InstanceFactory, [], DEPLOY_OPTIONS);
    await factory.registerLevel(level.address);
    ethernaut = await getContractAt(Ethernaut, await factory.ethernaut(), { from: PLAYER });
  });

  it("creates and completes a level instance", async () => {
    const created = await ethernaut.createLevelInstance(level.address.toLowerCase());
    const instance = await getContractAt(Instance, getCreatedInstance(ethernaut, created), {
      from: PLAYER,
    });
    assert.equal(await instance.infoNum(), 42);

    const failed = await ethernaut.submitLevelInstance(instance.address);
    assert.equal(isLevelCompleted(ethernaut, failed, PLAYER, level.address), false);

    await instance.authenticate("ethernaut0");
    const completed = await ethernaut.submitLevelInstance(instance.address);
    assert.equal(isLevelCompleted(ethernaut, completed, PLAYER, level.address), true);
    assert.equal(
      isLevelCompleted(ethernaut, completed, PLAYER.toLowerCase(), level.address.toLowerCase()),
      true
    );
    assert.equal(isLevelCompleted(ethernaut, completed, OTHER, level.address), false);
    assert.equal(isLevelCompleted(ethernaut, completed, PLAYER, OTHER), false);
    assert.equal(getCreatedInstance(ethernaut, completed), undefined);

    const statistics = await getContractAt(Statistics, await factory.proxyStats());
    assert.equal(await statistics.isLevelCompleted(PLAYER, level.address), true);
    assert.equal(await statistics.getTotalNoOfPlayers(), 1n);
  });
});
