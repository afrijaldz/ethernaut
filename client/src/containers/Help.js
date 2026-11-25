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
      <div>
        <main className="help-page">
          <h1>{strings.help}</h1>

          <section>
            <h2>Setup Metamask</h2>
            <MarkdownComponent target={strings.setupMetamask} />
          </section>

          <section>
            <h2>Game Mechanics</h2>
            <MarkdownComponent target={strings.gameMechanics} />
          </section>

          <section>
            <h2>Using the console</h2>
            <MarkdownComponent target={strings.usingConsole} />
          </section>

          <section>
            <h2>Beyond the console</h2>
            <MarkdownComponent target={strings.beyondConsole} />
          </section>

          <section>
            <h2>Troubleshooting</h2>
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
