import React from "react";
import Mosaic from "./Mosaic";
import * as constants from "../constants";
import { loadTranslations } from "../utils/translations";
import parse from "html-react-parser";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { withRouter } from "../hoc/withRouter";
import { randGoodIcon, randBadIcon } from "../utils/^^";
import { deployAdminContracts } from "../utils/deploycontract";
import {
  networkOnDeprecationOrDeprecated,
  isDeprecatedNetwork,
  deprecationStatus,
  deprecationDate,
} from "../utils/networkDeprecation";
import { store } from "./../store";
import * as actions from "../../src/actions";

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      chainId: 0,
    };
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_chainId" }).then((id) => {
        this.setState({ chainId: Number(id) });
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      window.scrollTo(0, 0);
    }
  }

  navigateToFirstIncompleteLevel() {
    // Find first incomplete level
    let target = this.props.levels[0].deployedAddress;
    for (let i = 0; i < this.props.levels.length; i++) {
      const level = this.props.levels[i];
      if (!level.deployedAddress) {
        return this.props.navigate(`${constants.PATH_LEVEL_ROOT}${i}`);
      }
      const completed = this.props.completedLevels[level.deployedAddress];
      if (!completed) {
        target = level.deployedAddress;
        break;
      }
    }

    // Navigate to first incomplete level
    this.props.navigate(`${constants.PATH_LEVEL_ROOT}${target}`);
  }

  async continueAnyway() {
    const deployWindow = document.querySelectorAll(".deploy-window-bg");
    deployWindow[0].style.display = "none";
  }

  async continueInReadOnly() {
    store.dispatch(actions.loadGamedata());
    store.dispatch(actions.setGameReadOnly(true));
    const accountConnectionWindow = document.querySelectorAll(
      ".account-connection-window-bg"
    );
    accountConnectionWindow[0].style.display = "none";
  }

  async displayConnectionWindow() {
    const accountConnectionWindow = document.querySelectorAll(
      ".account-connection-window-bg"
    );
    accountConnectionWindow[0].style.display = "block";
  }

  async requestAccounts() {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const accountConnectionWindow = document.querySelectorAll(
      ".account-connection-window-bg"
    );
    accountConnectionWindow[0].style.display = "none";
  }

  render() {
    let language = localStorage.getItem("lang");
    let strings = loadTranslations(language);
    const supportedNetworks = Object.keys(constants.NETWORKS).filter(
      (key) => key !== "LOCAL" && key !== "UNDEFINED"
    );

    // change the network to Base Sepolia
    async function switchToBaseSepolia() {
      let elements = document.querySelectorAll(".progress-bar-wrapper");
      const deployWindow = document.querySelectorAll(".deploy-window-bg");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: `0x${Number(
                constants.NETWORKS.BASE_SEPOLIA.id
              ).toString(16)}`,
            },
          ], //if on wrong network giving option to switch to Base Sepolia.
        });
        deployWindow[0].style.display = "none";
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          const baseSepolia = constants.NETWORKS_INGAME.BASE_SEPOLIA;
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${Number(baseSepolia.id).toString(16)}`,
                  chainName: baseSepolia.name,
                  rpcUrls: [baseSepolia.rpcUrl],
                  nativeCurrency: {
                    name: baseSepolia.currencyName,
                    symbol: baseSepolia.currencySymbol,
                    decimals: 18,
                  },
                  blockExplorerUrls: [baseSepolia.blockExplorer],
                },
              ],
            });
            deployWindow[0].style.display = "none";
          } catch (addError) {
            if (addError.code === 4001) {
              //User has rejected changing the request
              elements[0].style.display = "none";
            }
            console.error("Can't add nor switch to the selected network");
          }
        } else if (switchError.code === 4001) {
          //User has rejected changing the request
          if (elements[0]) elements[0].style.display = "none";
        }
      }
    }

    return (
      <div>
        <main>
          {/* Main title and buttons */}
          <section className="home-intro">
            <h1>{strings.title}</h1>
            <button
              onClick={() => {
                if (!store.getState().gamedata.readOnly) {
                  this.navigateToFirstIncompleteLevel();
                } else {
                  this.displayConnectionWindow();
                }
              }}
              className="ui-button home-intro__play"
            >
              {strings.playNow}
            </button>
          </section>
          {/*not Account Connected window*/}
          <div className="account-connection-window-bg ui-dialog-backdrop">
            <div
              className="ui-dialog"
              role="dialog"
              aria-labelledby="account-connection-title"
            >
              <button
                className="ui-button ui-button--secondary ui-dialog__close"
                aria-label={strings.close}
                onClick={this.continueInReadOnly}
              >
                ×
              </button>
              <p className="ui-dialog__icon">{randBadIcon()}</p>
              <h2 id="account-connection-title" className="ui-dialog__title">
                {strings.accountNotConnectedTitle}
              </h2>
              <p>{strings.accountNotConnectedMessage}</p>
              <div className="ui-dialog__actions">
                <button
                  className="ui-button"
                  onClick={async () => {
                    await this.requestAccounts();
                    window.location.reload();
                  }}
                >
                  {strings.connectAccount}
                </button>
              </div>
            </div>
          </div>
          {/*not Deployed window*/}
          <div className="deploy-window-bg ui-dialog-backdrop">
            {!networkOnDeprecationOrDeprecated(this.state.chainId) ? (
              <div
                className="ui-dialog"
                role="dialog"
                aria-labelledby="deploy-title"
              >
                {/*deploy window*/}
                <p className="ui-dialog__icon">{randGoodIcon()}</p>
                <h2 id="deploy-title" className="ui-dialog__title">
                  {strings.deployMessageTitle}
                </h2>
                {strings.deployMessage}
                {supportedNetworksList(supportedNetworks)}
                <p>{strings.deployConfirmation}</p>
                <div className="ui-dialog__actions">
                  <button
                    className="ui-button ui-button--secondary"
                    onClick={deployAdminContracts}
                  >
                    {strings.deployGame}
                  </button>
                  <button className="ui-button" onClick={switchToBaseSepolia}>
                    {strings.switchToBaseSepolia}
                  </button>
                </div>
                <p>{strings.deployNote}</p>
              </div>
            ) : (
              <div
                className="ui-dialog"
                role="dialog"
                aria-labelledby="deploy-title"
              >
                {/*deprecation window*/}
                <p className="ui-dialog__icon">{randBadIcon()}</p>
                <h2 id="deploy-title" className="ui-dialog__title">
                  {isDeprecatedNetwork(this.state.chainId)
                    ? strings.deprecatedNetwork
                    : strings.networkBeingDeprecated}
                </h2>
                {strings.deployMessage}
                {supportedNetworksList(supportedNetworks)}
                <div className="ui-dialog__actions">
                  <button className="ui-button" onClick={switchToBaseSepolia}>
                    {strings.switchToBaseSepolia}
                  </button>
                  {!isDeprecatedNetwork(this.state.chainId) && (
                    <button
                      className="ui-button ui-button--secondary"
                      onClick={this.continueAnyway}
                    >
                      {strings.continueAnyway}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Levels */}
          <Mosaic></Mosaic>
          {/* Game description */}
          <section className="ui-prose">{parse(strings.info)}</section>
        </main>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    levels: state.gamedata.levels,
    completedLevels: state.player.completedLevels,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({}, dispatch);
}

function supportedNetworksList(_supportedNetworks) {
  return (
    <ul>
      {_supportedNetworks.map((network, idx) => (
        <li key={idx}>
          {network}
          {networkOnDeprecationOrDeprecated(constants.NETWORKS[network].id) &&
            " (" +
              deprecationStatus(constants.NETWORKS[network].id) +
              " on " +
              deprecationDate(constants.NETWORKS[network].id) +
              ")"}
        </li>
      ))}
    </ul>
  );
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(App));
