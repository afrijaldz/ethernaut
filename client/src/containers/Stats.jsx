import React from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import * as actions from '../actions';
import { getLevelsSolvedByPlayer, checkIfPlayerExist, getTotalCompleted, getTotalFailures, getTotalCreated, getTotalPlayers } from '../utils/statsContract'
import { loadTranslations } from '../utils/translations'
import { validateAddress } from '../utils/ethutil'
import Statistic from '../components/stats/Statistic';
import StatisticPanel from '../components/stats/Panel';

class Stats extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      playerFilter: '',
      levelFilter: '',
      solvedLevels: [],
      totalCompleted: 0,
      totalCreated: 0,
      totalFailures: 0,
      totalPlayers: 0,
      lang: localStorage.getItem("lang"),
    }
  }

  componentDidMount() {
    if (this.props.networkId) this.collectsGlobalStats();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.networkId !== this.props.networkId) {
      this.collectsGlobalStats();
    }
  }

  async collectsGlobalStats() {
    const [completed, created, failures, totalPlayers] = await Promise.all([
      getTotalCompleted(this.props.networkId),
      getTotalCreated(this.props.networkId),
      getTotalFailures(this.props.networkId),
      getTotalPlayers(this.props.networkId)
    ])
    this.setState({
      totalCompleted: completed ? completed.toNumber() : 0,
      totalCreated: created ? created.toNumber() : 0,
      totalFailures: failures ? failures.toNumber() : 0,
      totalPlayers: totalPlayers ? totalPlayers.toNumber() : 0,
    })
  }

  async collectPlayerStats(playerAddress) {
    var itExists = await checkIfPlayerExist(playerAddress, this.props.networkId)
      if(itExists) {
        var levels = await getLevelsSolvedByPlayer(playerAddress, this.props.networkId)
        
        //loader off
        const elements = document.querySelectorAll('.progress-bar-wrapper');
        elements[0].style.display = 'none';
        
        // Resolve address of levels with name
        // Resolve number of levels solved

        //Show solved levels
        return {
          playerExists: true,
          levelsSolved: levels
        }
      } else {
        // loader off
        const elements = document.querySelectorAll('.progress-bar-wrapper');
        elements[0].style.display = 'none';
        //Show player doesn't exist
        return {
          playerExists: false,
          levelsSolved: []
        }
      }

  }

  async updatePlayerStats(playerAddress) {
    if(validateAddress(playerAddress)) {
      //loader on
      var progressBar = document.querySelectorAll('.progress-bar-wrapper')[0];
      progressBar.style.display = 'flex';

      this.setState({playerFilter: playerAddress});

      var stats = await this.collectPlayerStats(playerAddress);
      // sort the levels and display in ascending level of difficulty
      // woth noting that the sort is 'inplace'
      stats?.levelsSolved.sort((a, b) => +a.difficulty - +b.difficulty)
      this.setState({
        solvedLevels: stats?.levelsSolved
      })
    }
  }

  render() {
    const strings = loadTranslations(this.state.lang);

    return (
      <main className="stats-page">
        <h1>{strings.stats}</h1>
        <div className="stats-grid">
          <Statistic heading="Total number of players" value={this.state.totalPlayers} />
          <Statistic heading="Total number of instances created" value={this.state.totalCreated} />
          <Statistic heading="Total number of instances solved" value={this.state.totalCompleted} />
          <Statistic heading="Total number of instances failed" value={this.state.totalFailures} />
        </div>
        <form className="stats-search">
          <label htmlFor="stats-player-address">Player address</label>
          <input
            id="stats-player-address"
            type="text"
            className="ui-input"
            onChange={async(evt) => {
              evt.preventDefault();
              await this.updatePlayerStats(evt.target.value);
            }}
            onKeyDown={async(evt) => {
              if(evt.key === "Enter") evt.preventDefault();
            }}
          />
        </form>
        <StatisticPanel show={this.state.solvedLevels.length} title="Levels Completed">
          <ul className="stats-levels">
            {
              this.state.solvedLevels.map(
                (level) => (
                  <li key={level.name} className="stats-levels__row">
                    <span>{level.name}</span>
                    <span className="stats-levels__difficulty">{level.difficultyCircles}</span>
                  </li>
                )
              )
            }
          </ul>
        </StatisticPanel>
      </main>
    );
  }
}

function mapStateToProps(state) {
  return {
    networkId: state.network.networkId,
  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    collectStats: actions.collectStats
  }, dispatch)
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Stats)