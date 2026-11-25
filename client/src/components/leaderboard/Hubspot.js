import React from "react";
import Filter from "bad-words"
import { useToast } from "../utils/Toast";
import { checkIfAliasIsPresent } from "./checkIfAliasExist";

const filter = new Filter()

class HubspotForm extends React.Component{
  constructor() { 
    super()
    this.formRef = React.createRef();
  }

  componentDidMount() {
    if (window.hbspt) {
      // @ts-ignore
      window.hbspt.forms.create({
        target: "#hubspotForm",
        ...this.props,
        onFormReady: this.onFormReady,
        submitButtonClass: "leaderboard-alias-submit-button",
        onFormSubmitted: this.onFormSubmitted,
        onFormSubmit:this.onFormSubmit
      });
    }
  }

  onFormReady = (form) => { 
    const spans = form.querySelectorAll("span");
    const buttons = form.querySelectorAll(".leaderboard-alias-submit-button");
    const inputs = form.querySelectorAll("input");


    const emailElement = spans[0]
    const usernameElement = spans[2]
    const addressInput = inputs[2]
    const ethernautAddressLabel = spans[4]
    const checkboxLabel = spans[5]

    // HubSpot renders the form in an iframe, where the page stylesheet and its variables do not apply.
    const styles = getComputedStyle(document.documentElement);

    const textColor = styles.getPropertyValue('--color-text');
    const accentColor = styles.getPropertyValue('--color-accent');
    const touchTarget = styles.getPropertyValue('--touch-target');
    const onAccentColor = styles.getPropertyValue('--color-on-accent');

    emailElement.style.color = textColor;
    usernameElement.style.color = textColor;
    ethernautAddressLabel.style.color = textColor;
    checkboxLabel.style.color = textColor;

    buttons[0].style.backgroundColor = accentColor;
    buttons[0].style.border = "none";
    buttons[0].style.color = onAccentColor;
    buttons[0].style.minHeight = touchTarget;
    buttons[0].style.padding = '8px 16px';
    buttons[0].style.borderRadius = styles.getPropertyValue('--radius-control');
    buttons[0].style.cursor = 'pointer';

    for (const input of [inputs[0], inputs[1], addressInput]) {
      input.style.minHeight = touchTarget;
    }

    addressInput.style.pointerEvents = 'none';
    setNativeValue(addressInput, this.props.currentUser);

    form.addEventListener('submit', (event) => { 
      const alias = event.srcElement[1].value;
      const email = event.srcElement[0].value;
      if (!(alias && email)) { 
        this.props.toast("Please fill in all the fields");
        event.stopPropagation();
        return;
      }
      if (filter.isProfane(alias)) { 
        this.props.toast("Please don't use offensive words in your alias");
        event.stopPropagation();
        return;
      }
      if(filter.isProfane(email)) { 
        this.props.toast("Please don't use offensive words in your email");
        event.stopPropagation();
        return;
      }
      if(checkIfAliasIsPresent(alias)) { 
        this.props.toast("This alias is already taken");
        event.stopPropagation();
      }
    })
  }

  onFormSubmitted = (form) => { 
    form.remove();
    const outerElement = document.querySelector('#hubspotForm')
    const element = document.createElement('div')
    element.innerHTML = "Thanks for submitting the form."
    outerElement.insertAdjacentElement('afterbegin', element)
  }

  render() {
    return (
      <>
        <div>
          <div ref={this.formRef} id="hubspotForm" />
        </div>
      </>
    );
  }
}


function WithToast(Component) {
  return function WrappedComponent(props) {
    const { Toast, toast } = useToast(2)
    return (
      <>
        {Toast}
        <Component toast={toast} {...props} />
      </>
    );
  };
}

function setNativeValue(element, value) {
    let lastValue = element.value;
    element.value = value;
    let event = new Event("input", { target: element, bubbles: true });
    // React 15
    event.simulated = true;
    // React 16
    let tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

export default WithToast(HubspotForm);