import { css } from "lit";

export const shared = css`
  :host {
    color: #e8eaf6;
    font-family: Inter, system-ui, sans-serif;
  }
  button,
  input,
  textarea {
    font: inherit;
  }
  button {
    cursor: pointer;
  }
  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 16px;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }
  .field {
    width: 100%;
    box-sizing: border-box;
    background: #12141f;
    color: #e8eaf6;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px 14px;
    outline: none;
  }
  .field:focus {
    border-color: #7c8cff;
  }
  .primary,
  .ghost,
  .danger {
    border: 0;
    border-radius: 12px;
    padding: 12px 14px;
    font-weight: 600;
  }
  .primary {
    background: linear-gradient(135deg, #5e6bff, #52d7d8);
    color: #071018;
  }
  .ghost {
    background: rgba(255, 255, 255, 0.06);
    color: #e8eaf6;
  }
  .danger {
    background: transparent;
    color: #ff8d9a;
  }
  .muted {
    color: #9aa3c7;
    font-size: 0.92rem;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    font-size: 2rem;
    letter-spacing: -0.04em;
  }
`;
