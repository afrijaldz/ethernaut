import React from 'react';
import { Link } from '../router'
import * as constants from '../constants';
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import getlevelsdata from '../utils/getlevelsdata';
import { loadTranslations } from '../utils/translations';
//import moment from 'moment'

class Mosaic extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      lang: localStorage.getItem('lang')
    }
  }

  render() {

    // Array for tiles in the Mosaic
    var [levelData,] = getlevelsdata(this.props, 'mosaic');

    const strings = loadTranslations(this.state.lang);

    return (
      <section className="levels">
        <h2>{strings.uLevels}</h2>
        <ul className="level-grid">
          {levelData.map((level) => {
            return (
              <li key={level.name}>
                <Link
                  className="ui-card level-card"
                  to={
                    this.props.web3 && level.deployedAddress //on read only mode in custom network this field 'deployedAddress' isnt present
                      ? `${constants.PATH_LEVEL_ROOT}${level.deployedAddress}`
                      : `${constants.PATH_LEVEL_ROOT}${level.id}`
                  }
                >
                  <img className="level-tile level-card__art" alt="" src={level.src} />
                  <h3 className="level-card__name">{level.name}</h3>
                  <span className="level-card__difficulty">
                    <span className="visually-hidden">{strings.difficulty} </span>
                    {level.difficulty}
                  </span>
                  {level.completed && (
                    <span className="ui-badge ui-badge--success">✔ {strings.uCompleted}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    );
  }
}

function mapStateToProps(state) {
  return {
    web3: state.network.web3,
    levels: state.gamedata.levels,
    player: state.player,
    activeLevel: state.gamedata.activeLevel
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
  }, dispatch);
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Mosaic);
