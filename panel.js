class EnergyPanel extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }
        iframe {
          border: none;
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
      <iframe src="/local/community/ha-energy-dashboard/index.html"></iframe>
    `;
  }
}

customElements.define('energy-panel', EnergyPanel);
