import { useEffect, useRef, useState } from "react";

// Keep equal to the max-width of .ui-tooltip.
const MAX_WIDTH = 288;
const VIEWPORT_MARGIN = 16;

// The tooltip is fixed so that no parent clips it. It opens toward the larger
// vertical side of the viewport.
const getPosition = (trigger) => {
  const rect = trigger.getBoundingClientRect();
  const { clientWidth, clientHeight } = document.documentElement;
  const maxLeft = clientWidth - MAX_WIDTH - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));

  if (rect.top < clientHeight / 2) {
    return { left, top: rect.bottom };
  }
  return { left, bottom: clientHeight - rect.top };
};

const Tooltip = ({ content, children }) => {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({});

  const show = () => {
    setPosition(getPosition(containerRef.current));
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    const updatePosition = () => {
      setPosition(getPosition(containerRef.current));
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsVisible(false);
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className="ui-tooltip-container"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && (
        <div className="ui-tooltip" role="tooltip" style={position}>
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
