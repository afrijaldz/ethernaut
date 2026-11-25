import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import MarkdownComponent from "../components/common/Markdown";
import { loadTranslations } from "../utils/translations";

class Help extends React.Component {
  render() {
    let language = localStorage.getItem("lang");
    let strings = loadTranslations(language);

    return (
      <div className="main-wrapper">
        <main className="boxes">
          <h3>Setup Metamask</h3>
          <section>
            <MarkdownComponent target={strings.setupMetamask} />
          </section>

          <h3>Game Mechanics</h3>
          <section>
            <MarkdownComponent target={strings.gameMechanics} />
          </section>

          <h3>Using the console</h3>
          <section>
            <MarkdownComponent target={strings.usingConsole} />
          </section>

          <h3>Beyond the console</h3>
          <section>
            <MarkdownComponent target={strings.beyondConsole} />
          </section>

          <h3>Troubleshooting</h3>
          <section>
            <MarkdownComponent target={strings.troubleshooting} linkTarget="_blank" />
          </section>
        </main>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    language: state.lang,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Help);
