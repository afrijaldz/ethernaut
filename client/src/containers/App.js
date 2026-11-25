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
import * as actions from "../actions";
import { RESULT, switchNetwork } from "../utils/wallet";

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      networkError: false,
    };
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

  switchToBaseSepolia = async () => {
    this.setState({ networkError: false });
    const result = await switchNetwork(constants.NETWORKS_INGAME.BASE_SEPOLIA);
    if (result === RESULT.DONE) {
      document.querySelector(".deploy-window-bg").style.display = "none";
    }
    this.setState({ networkError: result === RESULT.FAILED });
  };

  render() {
    let language = localStorage.getItem("lang");
    let strings = loadTranslations(language);
    const supportedNetworks = Object.keys(constants.NETWORKS).filter(
      (key) => key !== "LOCAL" && key !== "UNDEFINED"
    );

    const networkError = this.state.networkError && (
      <p className="ui-alert ui-alert--danger" role="alert">
        {strings.baseSepoliaNotSupported}
      </p>
    );

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
                  this.props.setConnectionDialogOpen(true);
                }
              }}
              className="ui-button home-intro__play"
            >
              {strings.playNow}
            </button>
          </section>
          {/*not Deployed window*/}
          <div className="deploy-window-bg ui-dialog-backdrop">
            {!networkOnDeprecationOrDeprecated(this.props.networkId) ? (
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
                {networkError}
                <div className="ui-dialog__actions">
                  <button
                    className="ui-button ui-button--secondary"
                    onClick={deployAdminContracts}
                  >
                    {strings.deployGame}
                  </button>
                  <button className="ui-button" onClick={this.switchToBaseSepolia}>
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
                  {isDeprecatedNetwork(this.props.networkId)
                    ? strings.deprecatedNetwork
                    : strings.networkBeingDeprecated}
                </h2>
                {strings.deployMessage}
                {supportedNetworksList(supportedNetworks)}
                {networkError}
                <div className="ui-dialog__actions">
                  <button className="ui-button" onClick={this.switchToBaseSepolia}>
                    {strings.switchToBaseSepolia}
                  </button>
                  {!isDeprecatedNetwork(this.props.networkId) && (
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
    networkId: state.network.networkId,
    levels: state.gamedata.levels,
    completedLevels: state.player.completedLevels,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    { setConnectionDialogOpen: actions.setConnectionDialogOpen },
    dispatch
  );
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
