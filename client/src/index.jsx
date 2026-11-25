import React, { Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store, history } from "./store";
import { syncHistoryWithStore } from "react-router-redux";
import { BrowserRouter as Router, Route, Routes } from "react-router";
import * as ethutil from "./utils/ethutil";
import {
  discoverWallets,
  enableWalletConnect,
  getAccount,
  getChainId,
  getProvider,
  restoreWallet,
} from "./utils/wallet";
import "bootstrap/dist/css/bootstrap.css";
import "./styles/app.css";
import * as actions from "../src/actions";
import * as constants from "../src/constants";
import "./utils/^^";
import App from "./containers/App";
import NotFound404 from "./components/not-found/NotFound404";
import Header from "./containers/Header";
import ConnectionDialog from "./components/common/ConnectionDialog";
import Footer from "./components/common/Footer";
import Leaderboard from "./containers/Leaderboard";

// For bundle splitting without lazy loading.
const nonlazy = (component) => lazy(() => component);

const Level = nonlazy(import("./containers/Level"));
const Help = nonlazy(import("./containers/Help"));
const Stats = nonlazy(import("./containers/Stats"));

const container = document.getElementById("root");
const root = createRoot(container);

async function startGame() {
  enableWalletConnect(
    constants.WALLETCONNECT_PROJECT_ID,
    () => import("@walletconnect/ethereum-provider")
  );
  discoverWallets();
  if (!(await restoreWallet())) {
    store.dispatch(actions.loadGamedata());
    store.dispatch(actions.setConnectionDialogOpen(true));
    return;
  }

  const chainId = await getChainId();
  const player = await getAccount();
  ethutil.connectProvider(getProvider(), chainId, player);
  window.publicClient = ethutil.getPublicClient();
  window.walletClient = ethutil.getWalletClient();

  store.dispatch(actions.connectWallet());
  store.dispatch(actions.setNetworkId(chainId));
  store.dispatch(actions.loadGamedata());
  store.dispatch(actions.setPlayerAddress(player));
  store.dispatch(actions.loadEthernautContract());
  ethutil.watchAccountChanges((acct) => {
    store.dispatch(actions.setPlayerAddress(acct));
  }, player);
  ethutil.watchNetwork({
    gasPrice: (price) =>
      store.dispatch(actions.setGasPrice(Math.floor(Number(price) * 1.1))),
    networkId: (id) => {
      if (id !== store.getState().network.networkId)
        store.dispatch(actions.setNetworkId(id));
    },
    blockNum: (num) => {
      if (num !== store.getState().network.blockNum)
        store.dispatch(actions.setBlockNum(num));
    },
  });
}

function Root() {
  // The dialogs must be on the page before the game starts.
  useEffect(() => {
    startGame();
  }, []);

  return (
    <Provider store={store}>
      <Router history={syncHistoryWithStore(history, store)}>
        <Suspense fallback={<div>Loading...</div>}>
          <div className="app-shell">
            <Header></Header>
            <div className="app-shell__content">
              <Routes>
                <Route path={constants.PATH_HELP} element={<Help />} />
                <Route path={constants.PATH_LEVEL} element={<Level />} />
                <Route path={constants.PATH_STATS} element={<Stats />} />
                <Route path={constants.PATH_LEADERBOARD} element={<Leaderboard />} />
                <Route exact path="/" element={<App />} />
                <Route path="*" element={<NotFound404 />} />
              </Routes>
            </div>
            <Footer></Footer>
            <ConnectionDialog />
          </div>
        </Suspense>
      </Router>
    </Provider>
  );
}

root.render(<Root />);
