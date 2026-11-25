// Run with: node --test client/src/utils/wallet.test.mjs
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import Web3 from "web3";

const storage = new Map();
globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

const NETWORK = {
  id: "84532",
  name: "base-sepolia",
  currencyName: "Base-ETH",
  currencySymbol: "ETH",
  rpcUrl: "https://sepolia.base.org",
  blockExplorer: "https://sepolia.basescan.org",
};

let wallet;

// Answers each method from `answers`. A function is called, an Error-like value is thrown.
function createProvider(answers) {
  return {
    request: mock.fn(async ({ method }) => {
      const answer = answers[method];
      if (answer && answer.code) throw answer;
      return typeof answer === "function" ? answer() : answer;
    }),
  };
}

function createWallet(name, provider = createProvider({})) {
  return { info: { uuid: name, name, rdns: `com.${name}`, icon: "" }, provider };
}

function announce(detail) {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", { detail })
  );
}

const getMethods = (provider) =>
  provider.request.mock.calls.map((call) => call.arguments[0].method);

let testNumber = 0;

beforeEach(async () => {
  mock.method(console, "error", () => {});
  storage.clear();
  globalThis.window = new EventTarget();
  // The module holds state, so each test loads its own copy.
  wallet = await import(`./wallet.js?test=${testNumber++}`);
  wallet.discoverWallets();
});

afterEach(() => {
  mock.restoreAll();
});

describe("discovery", () => {
  it("requests announcements", () => {
    const listener = mock.fn();
    window.addEventListener("eip6963:requestProvider", listener);
    wallet.discoverWallets();
    window.removeEventListener("eip6963:requestProvider", listener);
    assert.equal(listener.mock.callCount(), 1);
  });

  it("tells the subscribers about a late announcement", () => {
    const listener = mock.fn();
    const unsubscribe = wallet.subscribeToWallets(listener);
    announce(createWallet("first"));
    assert.equal(listener.mock.callCount(), 1);
    assert.equal(wallet.getWallets().length, 1);
    unsubscribe();
    announce(createWallet("second"));
    assert.equal(listener.mock.callCount(), 1);
    assert.equal(wallet.getWallets().length, 2);
  });

  it("lists a wallet that announces itself twice only once", () => {
    announce(createWallet("first"));
    announce(createWallet("first"));
    assert.equal(wallet.getWallets().length, 1);
  });

  it("ignores malformed announcements", () => {
    announce(null);
    announce({ info: { uuid: "x", name: "x" } });
    announce({ info: { uuid: "x", name: "x", rdns: "x" }, provider: {} });
    assert.equal(wallet.getWallets().length, 0);
  });

  it("offers window.ethereum only when no wallet announced itself", () => {
    window.ethereum = createProvider({});
    assert.equal(wallet.getWallets()[0].provider, window.ethereum);
    const first = createWallet("first");
    announce(first);
    assert.deepEqual(wallet.getWallets(), [first]);
  });

  it("accepts only data image icons", () => {
    const icon = "data:image/svg+xml,x";
    assert.equal(wallet.getSafeIcon({ icon }), icon);
    assert.equal(wallet.getSafeIcon({ icon: "https://example.com/x.png" }), null);
    assert.equal(wallet.getSafeIcon({ icon: "javascript:alert(1)" }), null);
    assert.equal(wallet.getSafeIcon({}), null);
  });
});

describe("remembered wallet", () => {
  beforeEach(() => {
    localStorage.setItem(wallet.STORAGE_WALLET_KEY, "com.second");
  });

  it("is restored after a late announcement, without a prompt", async () => {
    const second = createWallet(
      "second",
      createProvider({ eth_accounts: ["0x1"] })
    );
    const restored = wallet.restoreWallet();
    announce(createWallet("first"));
    announce(second);
    assert.equal(await restored, true);
    assert.equal(wallet.getProvider(), second.provider);
    assert.deepEqual(getMethods(second.provider), ["eth_accounts"]);
  });

  it("is not restored without a connected account", async () => {
    announce(createWallet("second", createProvider({ eth_accounts: [] })));
    assert.equal(await wallet.restoreWallet(), false);
    assert.equal(wallet.getProvider(), undefined);
  });

  it("is not restored when the wallet is gone", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const restored = wallet.restoreWallet();
    announce(createWallet("first"));
    mock.timers.runAll();
    mock.timers.reset();
    assert.equal(await restored, false);
  });

  it("is not restored when the wallet returns an error", async () => {
    announce(
      createWallet("second", createProvider({ eth_accounts: { code: -32603 } }))
    );
    assert.equal(await wallet.restoreWallet(), false);
  });

  it("can be the wallet in window.ethereum", async () => {
    window.ethereum = createProvider({ eth_accounts: ["0x1"] });
    wallet.selectWallet(wallet.getWallets()[0]);
    assert.equal(await wallet.restoreWallet(), true);
    assert.equal(wallet.getProvider(), window.ethereum);
  });
});

describe("connection", () => {
  it("uses only the second wallet after it is chosen", async () => {
    const answers = {
      eth_requestAccounts: ["0x1"],
      eth_chainId: "0x14a34",
      wallet_switchEthereumChain: null,
    };
    const first = createWallet("first", createProvider(answers));
    const second = createWallet("second", createProvider(answers));
    window.ethereum = first.provider;
    announce(first);
    announce(second);

    const chosen = wallet.getWallets()[1];
    assert.equal(await wallet.requestAccounts(chosen), wallet.RESULT.DONE);
    wallet.selectWallet(chosen);
    assert.equal(await wallet.switchNetwork(NETWORK), wallet.RESULT.DONE);

    assert.equal(wallet.getProvider(), second.provider);
    assert.equal(first.provider.request.mock.callCount(), 0);
    assert.deepEqual(getMethods(second.provider), [
      "eth_requestAccounts",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
    assert.equal(localStorage.getItem(wallet.STORAGE_WALLET_KEY), "com.second");
  });

  it("sends the web3 transactions to the selected wallet", async () => {
    const first = createWallet("first");
    const second = createWallet(
      "second",
      createProvider({ eth_sendTransaction: { code: 4001, message: "No" } })
    );
    window.ethereum = first.provider;
    wallet.selectWallet(second);
    const address = "0x0000000000000000000000000000000000000001";
    const web3 = new Web3(wallet.getProvider());
    await assert.rejects(
      web3.eth.sendTransaction({ from: address, to: address, gas: 1, gasPrice: 1 }),
      { code: 4001 }
    );
    assert.ok(getMethods(second.provider).includes("eth_sendTransaction"));
    assert.equal(first.provider.request.mock.callCount(), 0);
  });

  it("reports a rejection and other errors", async () => {
    const request = (code) =>
      wallet.requestAccounts(
        createWallet("first", createProvider({ eth_requestAccounts: { code } }))
      );
    assert.equal(await request(4001), wallet.RESULT.REJECTED);
    assert.equal(await request(-32002), wallet.RESULT.FAILED);
  });
});

describe("network switch", () => {
  const switchWith = async (answers) => {
    const provider = createProvider(answers);
    wallet.selectWallet(createWallet("first", provider));
    const result = await wallet.switchNetwork(NETWORK);
    return { result, methods: getMethods(provider) };
  };

  it("does not add the chain after a rejection", async () => {
    const { result, methods } = await switchWith({
      wallet_switchEthereumChain: { code: 4001 },
    });
    assert.equal(result, wallet.RESULT.REJECTED);
    assert.deepEqual(methods, ["wallet_switchEthereumChain"]);
  });

  for (const code of [4902, -32603]) {
    it(`adds the chain after error ${code}`, async () => {
      const { result, methods } = await switchWith({
        wallet_switchEthereumChain: { code },
        wallet_addEthereumChain: null,
        eth_chainId: "0x14a34",
      });
      assert.equal(result, wallet.RESULT.DONE);
      assert.deepEqual(methods, [
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain",
        "eth_chainId",
      ]);
    });
  }

  it("reports a rejection to add the chain", async () => {
    const { result } = await switchWith({
      wallet_switchEthereumChain: { code: 4902 },
      wallet_addEthereumChain: { code: 4001 },
    });
    assert.equal(result, wallet.RESULT.REJECTED);
  });

  it("fails when the wallet cannot add the chain", async () => {
    const { result } = await switchWith({
      wallet_switchEthereumChain: { code: 4902 },
      wallet_addEthereumChain: { code: -32601 },
    });
    assert.equal(result, wallet.RESULT.FAILED);
  });

  it("fails when the wallet stays on another chain", async () => {
    const { result } = await switchWith({
      wallet_switchEthereumChain: null,
      eth_chainId: "0x1",
    });
    assert.equal(result, wallet.RESULT.FAILED);
  });
});
