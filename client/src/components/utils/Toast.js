import { useState } from "react";

export function useToast(time) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  return {
    Toast: (
      <div
        className={visible ? "ui-toast ui-toast--visible" : "ui-toast"}
        role="status"
      >
        {message}
      </div>
    ),
    toast: (newMessage) => {
      setMessage(newMessage);
      setVisible(true);
      setTimeout(() => {
        setVisible(false);
      }, time * 1000 || 1000);
    },
  };
}
