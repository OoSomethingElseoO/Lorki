"use client";

import React from "react";
import styled from "styled-components";

const Loader = () => {
  return (
    <StyledWrapper>
      <div className="loader">
        <div className="cell d-0" />
        <div className="cell d-1" />
        <div className="cell d-2" />
        <div className="cell d-1" />
        <div className="cell d-2" />
        <div className="cell d-2" />
        <div className="cell d-3" />
        <div className="cell d-3" />
        <div className="cell d-4" />
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .loader {
    --cell-size: 52px;
    --cell-spacing: 1px;
    --cells: 3;
    --total-size: calc(var(--cells) * (var(--cell-size) + 2 * var(--cell-spacing)));
    display: flex;
    flex-wrap: wrap;
    width: var(--total-size);
    height: var(--total-size);
  }

  .cell {
    flex: 0 0 var(--cell-size);
    margin: var(--cell-spacing);
    background-color: transparent;
    box-sizing: border-box;
    border-radius: 4px;
    animation: 1.5s ripple ease infinite;
  }

  .cell.d-1 {
    animation-delay: 100ms;
  }

  .cell.d-2 {
    animation-delay: 200ms;
  }

  .cell.d-3 {
    animation-delay: 300ms;
  }

  .cell.d-4 {
    animation-delay: 400ms;
  }

  /* Brand ramp — ochre (--gold) through sand-deep to teal (--teal), the
     same warm-to-cool pairing already used as the site's second accent
     (see the palette comment in globals.css), not the original neon
     green-to-cyan gradient this component ships with by default. */
  .cell:nth-child(1) {
    --cell-color: var(--gold);
  }

  .cell:nth-child(2) {
    --cell-color: #b8731c;
  }

  .cell:nth-child(3) {
    --cell-color: #c98d3c;
  }

  .cell:nth-child(4) {
    --cell-color: #d3a35f;
  }

  .cell:nth-child(5) {
    --cell-color: var(--sand-deep);
  }

  .cell:nth-child(6) {
    --cell-color: #a3a479;
  }

  .cell:nth-child(7) {
    --cell-color: #6f9078;
  }

  .cell:nth-child(8) {
    --cell-color: #3f7772;
  }

  .cell:nth-child(9) {
    --cell-color: var(--teal);
  }

  /* Animation */
  @keyframes ripple {
    0% {
      background-color: transparent;
    }

    30% {
      background-color: var(--cell-color);
    }

    60% {
      background-color: transparent;
    }

    100% {
      background-color: transparent;
    }
  }
`;

export default Loader;
