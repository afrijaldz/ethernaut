import React, { createRef } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import CodeComponent from "../components/levels/Code";
import NotFound404 from "../components/not-found/NotFound404";
import Author from "../components/levels/Author";
import MarkdownComponent from "../components/common/Markdown";
import * as actions from "../actions";
import * as constants from "../constants";
import { loadTranslations } from "../utils/translations";
import { Link } from "../router";
import getlevelsdata from "../utils/getlevelsdata";
import { withRouter } from "../hoc/withRouter";
import { getLevelKey } from "../utils/contractutil";
import { deployAndRegisterLevel } from "../utils/deploycontract";
import { store } from "../store";

class Level extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      requestedInstance: false,
      submittedIntance: false,
      selectorOpen: false,
    };
    this.selectorRef = createRef();
    this.selectorButtonRef = createRef();
  }

  componentDidMount() {
    this.props.activateLevel(this.props.params.address);
    document.addEventListener("mousedown", this.handleClickOutside);
    document.addEventListener("keydown", this.handleKeyDown);
  }

  componentWillUnmount() {
    if (this.props.activateLevel) {
      this.props.deactivateLevel(this.props.activateLevel);
    }
    document.removeEventListener("mousedown", this.handleClickOutside);
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  componentDidUpdate() {
    const key = getLevelKey(this.props.params.address);
    if (
      this.props.notFoundAddress !== this.props.params.address &&
      this.props.level?.[key] !== this.props.params.address
    ) {
      this.props.activateLevel(this.props.params.address);
    }
  }

  // use arrow function to prevent this binding
  deployFactoryContract = async () => {
    const levelFactory = await deployAndRegisterLevel(this.props.level);
    if (!levelFactory) return;
    this.props.loadGameData();
    this.props.activateLevel(levelFactory.address);
  };

  createInstance = (evt) => {
    if (!this.state.requestedInstance) {
      this.props.loadLevelInstance(this.props.level, false, true);
      this.setState({ requestedInstance: true });
      setTimeout(() => this.setState({ requestedInstance: false }), 2000);
    }
  };

  toggleSelector = () => {
    this.setState({ selectorOpen: !this.state.selectorOpen });
  };

  closeSelector = () => {
    if (this.state.selectorOpen) this.setState({ selectorOpen: false });
  };

  handleClickOutside = (event) => {
    if (this.selectorRef.current && !this.selectorRef.current.contains(event.target)) {
      this.closeSelector();
    }
  };

  handleKeyDown = (event) => {
    if (event.key === "Escape" && this.state.selectorOpen) {
      this.closeSelector();
      this.selectorButtonRef.current.focus();
    }
  };

  render() {
    const { level, levelCompleted } = this.props;
    const { submittedIntance, selectorOpen } = this.state;
    var [levelData, selectedLevel] = getlevelsdata(this.props, "levelPage");

    if (this.props.notFoundAddress === this.props.params.address) {
      return <NotFound404 />;
    }
    if (!level) return null;
    const showCode = levelCompleted || level.revealCode;
    const showCompletedDescription =
      constants.SHOW_ALL_COMPLETE_DESCRIPTIONS || levelCompleted;

    let description = null;
    let language = localStorage.getItem("lang");
    let strings = loadTranslations(language);
    let isDescriptionMissingTranslation = false;

    try {
      description = require(`../gamedata/${language}/descriptions/levels/${level.description}`);
    } catch (e) {
      //FIX-ME: If language selected is english then "language" variable is null and not "en"
      if (language) isDescriptionMissingTranslation = true; // Only set it if language is not null (i.e. some language different from english)
      description = require(`../gamedata/en/descriptions/levels/${level.description}`);
    }
    let completedDescription = null;

    let isCompleteDescriptionMissingTranslation = false;
    if (showCompletedDescription && level.completedDescription) {
      try {
        completedDescription = require(`../gamedata/${language}/descriptions/levels/${level.completedDescription}`);
      } catch (e) {
        isCompleteDescriptionMissingTranslation = true;
        completedDescription = require(`../gamedata/en/descriptions/levels/${level.completedDescription}`);
      }
    }

    let poweredBy =
      level.poweredBy?.src && level.poweredBy?.href ? level.poweredBy : null;

    let sourcesFile = null;
    try {
      sourcesFile = require(`../contracts/src/levels/${level.instanceContract}`);
    } catch (e) {
      console.log(e);
    }

    const nextLevelId = findNextLevelId(this.props.level, this.props.levels);

    const showNext = levelCompleted && nextLevelId;
    const showSubmit = this.props.levelEmitted && !levelCompleted;
    const showInstance = !store.getState().gamedata.readOnly && this.props.web3;

    return (
      <main className="level-page">
        {(isDescriptionMissingTranslation ||
          isCompleteDescriptionMissingTranslation) && (
            <div className="ui-alert ui-alert--warning">
              {strings.levelNotTranslated}{" "}
              <a
                className="level-page__touch-link"
                href="https://github.com/afrijaldz/ethernaut/blob/master/CONTRIBUTING.md#translations-and-additional-languages"
              >
                {strings.contributeTranslation}
              </a>
            </div>
          )}

        {/* LEVEL SELECTOR */}
        <div ref={this.selectorRef} className="level-selector">
          <h1 className="level-selector__heading">
            <button
              ref={this.selectorButtonRef}
              type="button"
              className="ui-button ui-button--secondary level-selector__button"
              aria-expanded={selectorOpen}
              aria-controls="level-selector-list"
              onClick={this.toggleSelector}
            >
              <span className="level-selector__name">{level.name}</span>
              <span className="level-selector__difficulty">
                <span className="visually-hidden">{strings.difficulty} </span>
                {selectedLevel.difficulty}
              </span>
            </button>
          </h1>
          <nav
            id="level-selector-list"
            className="ui-menu level-selector__list"
            aria-label={strings.uLevels}
            hidden={!selectorOpen}
          >
            {levelData.map((item) => (
              <Link
                key={item.name}
                className="ui-menu__item"
                to={`${constants.PATH_LEVEL_ROOT}${item.deployedAddress || item.id}`}
                aria-current={item === selectedLevel ? "page" : undefined}
                onClick={this.closeSelector}
              >
                <span className="level-selector__name">
                  {item.name}
                  {item.completed && (
                    <span className="ui-badge ui-badge--success">
                      ✔ {strings.uCompleted}
                    </span>
                  )}
                </span>
                <span className="level-selector__difficulty">
                  <span className="visually-hidden">{strings.difficulty} </span>
                  {item.difficulty}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <img
          alt={`${level.name} level`}
          className="level-tile level-page__art"
          src={selectedLevel.src}
        />

        {/* POWERED BY */}
        {poweredBy && (
          <a className="level-powered-by" href={poweredBy.href}>
            {strings.poweredBy}
            <img
              className="level-tile level-powered-by__logo"
              alt=""
              src={poweredBy.src}
            />
          </a>
        )}

        {/* DESCRIPTION */}
        {!showCompletedDescription && (
          <section className="ui-card">
            <MarkdownComponent target={description} />
          </section>
        )}

        {/* COMPLETED DESCRIPTION */}
        {completedDescription && (
          <section className="ui-card">
            <MarkdownComponent target={completedDescription} />
          </section>
        )}

        {/* CODE */}
        {showCode && sourcesFile && <CodeComponent target={sourcesFile} />}

        {/* BUTTONS */}
        {level.levelContract && (showNext || showSubmit || showInstance) && (
          <div className="level-actions">
            {/* NEXT LEVEL */}
            {showNext && (
              <button
                type="button"
                className="ui-button"
                onClick={() =>
                  this.props.navigate(
                    `${constants.PATH_LEVEL_ROOT}${nextLevelId}`
                  )
                }
              >
                {strings.nextLevel}
              </button>
            )}

            {/* SUBMIT */}
            {showSubmit && (
              <button
                type="button"
                className="ui-button"
                onClick={() => {
                  if (!submittedIntance && nextLevelId) {
                    this.props.submitLevelInstance(level);
                    this.setState({ submittedIntance: true });
                    setTimeout(
                      () => this.setState({ submittedIntance: false }),
                      2000
                    );
                  }
                }}
              >
                {strings.submitInstance}
              </button>
            )}

            {/* DEPLOY OR CREATE */}
            {showInstance && (
              <button
                type="button"
                className={`ui-button ${
                  showNext || showSubmit ? "ui-button--secondary" : ""
                }`}
                onClick={
                  level.deployedAddress
                    ? this.createInstance
                    : this.deployFactoryContract
                }
              >
                {level.deployedAddress
                  ? strings.getNewInstance
                  : strings.deployLevel}
              </button>
            )}
          </div>
        )}

        {/* AUTHOR */}
        {level.author && <Author author={level.author} />}
      </main>
    );
  }
}

function findNextLevelId(level, list) {
  // check if we are a predeployed chain to know which key to use
  for (let i = 0; i < list.length; i++) {
    const otherLevel = list[i];
    if (level.deployedAddress === otherLevel.deployedAddress) {
      if (i < list.length - 1) {
        const listItem = list[i + 1];
        return listItem.deployedAddress || listItem.deployId;
      } else return list[0].deployedAddress || list[0].deployId;
    }
  }
}

function mapStateToProps(state) {
  const level = state.gamedata.activeLevel;

  return {
    web3: state.network.web3,
    networkId: state.network.networkId,
    level: level,
    activeLevel: level,
    notFoundAddress: state.gamedata.notFoundAddress,
    player: state.player,
    levels: state.gamedata.levels,
    levelCompleted:
      level && state.player.completedLevels[level.deployedAddress] > 0,
    levelEmitted:
      level && state.contracts.levels[level.deployedAddress] !== undefined,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      activateLevel: actions.activateLevel,
      deactivateLevel: actions.deactivateLevel,
      loadLevelInstance: actions.loadLevelInstance,
      submitLevelInstance: actions.submitLevelInstance,
      loadGameData: actions.loadGamedata,
    },
    dispatch
  );
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Level));
