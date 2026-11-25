import React, { createRef } from "react";
import { connect } from "react-redux";
import { withRouter } from "../hoc/withRouter";
import { Link } from "react-router";
import { bindActionCreators } from "redux";
import * as actions from "../actions";
import * as constants from "../constants";
import { loadTranslations } from "../utils/translations";
import PropTypes from "prop-types";
import { ProgressBar } from "react-loader-spinner";
import { RESULT, switchNetwork } from "../utils/wallet";

const NETWORKS_SECTION = "networks";
const LANGUAGES_SECTION = "languages";

class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dark: document.documentElement.dataset.theme === "dark",
      lang: localStorage.getItem("lang"),
      networkError: false,
      openSection: null,
      menuOpen: false,
    };
    this.menuContainerRef = createRef();
    this.menuButtonRef = createRef();
  }

  static propTypes = {
    location: PropTypes.object.isRequired,
  };

  componentDidMount() {
    document.addEventListener("mousedown", this.handleClickOutside);
    document.addEventListener("keydown", this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  handleClickOutside = (event) => {
    if (!this.menuContainerRef.current.contains(event.target)) {
      this.closeMenu();
    }
  };

  handleKeyDown = (event) => {
    if (event.key === "Escape" && this.state.menuOpen) {
      this.closeMenu();
      this.menuButtonRef.current.focus();
    }
  };

  toggleMenu = () => {
    this.setState({ menuOpen: !this.state.menuOpen });
  };

  closeMenu = () => {
    if (this.state.menuOpen) this.setState({ menuOpen: false });
  };

  toggleSection(section) {
    this.setState({
      openSection: this.state.openSection === section ? null : section,
    });
  }

  async changeNetwork(network) {
    if (Number(network.id) === this.props.networkId) return;
    this.closeMenu();
    this.setState({ networkError: false });
    const progressBar = document.querySelector(".progress-bar-wrapper");
    progressBar.style.display = "flex";
    const result = await switchNetwork(network);
    // After a switch the page reloads, see the setNetwork middleware.
    if (result !== RESULT.DONE) progressBar.style.display = "none";
    this.setState({ networkError: result === RESULT.FAILED });
  }

  toggleTheme = () => {
    const theme = this.state.dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    this.setState({ dark: theme === "dark" });
  };

  render() {
    let strings = loadTranslations(this.state.lang);

    const LANGUAGES_MAP = {
      en: strings.english,
      es: strings.spanish,
      pt_br: strings.portuguese,
      ja: strings.japanese,
      zh_cn: strings.chinese_simplified,
      zh_tw: strings.chinese_traditional,
      fr: strings.french,
      ru: strings.russian,
      ar: strings.arabic,
      tr: strings.turkish,
      uk: strings.ukrainian,
      ko: strings.korean,
      vi: strings.vietnamese,
      hu: strings.hungarian,
    };

    const { menuOpen, openSection } = this.state;
    const { readOnly } = this.props;
    const isHome = window.location.pathname === constants.PATH_ROOT;

    return (
      <>
        <header className="site-header">
          <div className="site-header__inner">
            <Link className="site-header__wordmark" to={constants.PATH_ROOT}>
              The Ethernaut
            </Link>
            <a
              className="site-header__notice"
              href="https://github.com/OpenZeppelin/ethernaut"
            >
              Unofficial fork, not affiliated with OpenZeppelin.
            </a>
            <div ref={this.menuContainerRef}>
              <button
                ref={this.menuButtonRef}
                type="button"
                className="ui-button ui-button--secondary"
                aria-expanded={menuOpen}
                aria-controls="site-menu"
                onClick={this.toggleMenu}
              >
                {strings.Menu}
              </button>
              <nav
                id="site-menu"
                className="site-header__menu ui-menu"
                aria-label={strings.Menu}
                hidden={!menuOpen}
              >
                <Link
                  className="ui-menu__item"
                  to={isHome ? constants.PATH_HELP : constants.PATH_ROOT}
                  onClick={this.closeMenu}
                >
                  {isHome ? strings.help : strings.home}
                </Link>
                {isHome && !!this.props.web3 && !readOnly && (
                  <Link
                    className="ui-menu__item"
                    to={constants.PATH_LEADERBOARD}
                    onClick={this.closeMenu}
                  >
                    {strings.leaderboard}
                  </Link>
                )}
                <button
                  type="button"
                  className="ui-menu__item"
                  role="switch"
                  aria-checked={this.state.dark}
                  onClick={this.toggleTheme}
                >
                  {strings.darkTheme}
                </button>
                {this.props.web3 && !readOnly && (
                  <>
                    <button
                      type="button"
                      className="ui-menu__item"
                      aria-expanded={openSection === NETWORKS_SECTION}
                      aria-controls="site-menu-networks"
                      onClick={() => this.toggleSection(NETWORKS_SECTION)}
                    >
                      {strings.Networks}
                    </button>
                    <div
                      id="site-menu-networks"
                      className="ui-menu__group"
                      hidden={openSection !== NETWORKS_SECTION}
                    >
                      {Object.values(constants.NETWORKS_INGAME)
                        .filter((network) => network && network.name !== "local")
                        .map((network) => (
                          <button
                            key={network.name}
                            type="button"
                            className="ui-menu__item"
                            aria-current={
                              Number(network.id) === this.props.networkId
                            }
                            onClick={() => this.changeNetwork(network)}
                          >
                            {network.name}
                          </button>
                        ))}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  className="ui-menu__item"
                  aria-expanded={openSection === LANGUAGES_SECTION}
                  aria-controls="site-menu-languages"
                  onClick={() => this.toggleSection(LANGUAGES_SECTION)}
                >
                  {strings.Languages}
                </button>
                <div
                  id="site-menu-languages"
                  className="ui-menu__group"
                  hidden={openSection !== LANGUAGES_SECTION}
                >
                  {Object.keys(LANGUAGES_MAP).map((language) => (
                    <button
                      key={language}
                      type="button"
                      className="ui-menu__item"
                      onClick={() => this.props.setLang(language)}
                    >
                      {LANGUAGES_MAP[language]}
                    </button>
                  ))}
                  <a
                    className="ui-menu__item"
                    href="https://github.com/afrijaldz/ethernaut/blob/master/CONTRIBUTING.md#translations-and-additional-languages"
                  >
                    {strings.contributeTranslation}
                  </a>
                </div>
                {readOnly && (
                  <button
                    type="button"
                    className="ui-menu__item"
                    onClick={() => {
                      this.closeMenu();
                      this.props.setConnectionDialogOpen(true);
                    }}
                  >
                    {strings.connectAccount}
                  </button>
                )}
              </nav>
            </div>
          </div>
        </header>
        <ProgressBar
          height="100"
          width="100"
          borderColor="currentColor"
          barColor="currentColor"
          ariaLabel="progress-bar-loading"
          wrapperStyle={{}}
          wrapperClass="progress-bar-wrapper"
          visible={true}
        />
        {readOnly && (
          <div className="site-alert">
            <div className="ui-alert ui-alert--warning">
              <strong>{strings.warning}! </strong>
              <span>{strings.warningMessage}</span>
            </div>
          </div>
        )}
        {this.state.networkError && (
          <div className="site-alert">
            <div className="ui-alert ui-alert--danger" role="alert">
              {strings.baseSepoliaNotSupported}
            </div>
          </div>
        )}
      </>
    );
  }
}

function mapStateToProps(state) {
  return {
    web3: state.network.web3,
    networkId: state.network.networkId,
    readOnly: state.gamedata.readOnly,
    allLevelsCompleted: state.player.allLevelsCompleted,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      setLang: actions.setLang,
      setConnectionDialogOpen: actions.setConnectionDialogOpen,
    },
    dispatch
  );
}

export default withRouter(
  connect(mapStateToProps, mapDispatchToProps)(Header)
);
